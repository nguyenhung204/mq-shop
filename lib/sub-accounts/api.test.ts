import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const get = vi.fn();
const del = vi.fn();
vi.mock("@/lib/api/client", async (orig) => {
  const real = await orig<typeof import("@/lib/api/client")>();
  return { ...real, api: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a), delete: (...a: unknown[]) => del(...a) } };
});

import { ApiError } from "@/lib/api/client";
import { adminSubAccountsApi, declineSubAccountApi, subAccountsApi } from "@/lib/api/sub-accounts";
import { createKeyedRunners } from "@/lib/queries/idempotent-run";
import { validateCreate } from "./model";

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  del.mockReset();
  post.mockResolvedValue({});
  get.mockResolvedValue({});
  del.mockResolvedValue({});
});

const H = (k: string) => ({ headers: { "Idempotency-Key": k } });

describe("sub-account routes", () => {
  it("owner create: typed form -> exact body, Idempotency-Key", async () => {
    const r = validateCreate({ email: " p@q.co ", fullName: "Pat", regionCode: "sg" }, false);
    if (!r.ok) throw new Error("ok expected");
    await subAccountsApi.create(r.body, "k1");
    expect(post).toHaveBeenCalledWith("/sub-accounts", { email: "p@q.co", fullName: "Pat", regionCode: "SG" }, H("k1"));
  });
  it("admin create: reason in the body, id encoded", async () => {
    const r = validateCreate({ email: "p@q.co", fullName: "", regionCode: "", reason: "Client asked" }, true);
    if (!r.ok || !r.body.reason) throw new Error("ok expected");
    await adminSubAccountsApi.create("a/b", { ...r.body, reason: r.body.reason }, "k2");
    expect(post).toHaveBeenCalledWith("/admin/accounts/a%2Fb/sub-accounts", { email: "p@q.co", reason: "Client asked" }, H("k2"));
  });
  it("withdraw is DELETE with a key; revoke likewise; invite create posts no body", async () => {
    await subAccountsApi.withdraw("u1", "k3");
    expect(del).toHaveBeenLastCalledWith("/sub-accounts/u1", H("k3"));
    await subAccountsApi.revokeInvite("i1", "k4");
    expect(del).toHaveBeenLastCalledWith("/sub-accounts/invites/i1", H("k4"));
    await subAccountsApi.createInvite("k5");
    expect(post).toHaveBeenLastCalledWith("/sub-accounts/invites", undefined, H("k5"));
  });
  it("discard pending: POST with the reason and a key", async () => {
    await adminSubAccountsApi.discardPending("u9", { reason: "typo in e-mail" }, "k6");
    expect(post).toHaveBeenLastCalledWith("/admin/accounts/u9/discard-pending", { reason: "typo in e-mail" }, H("k6"));
  });
  it("admin reads: tree with its bounds, root", async () => {
    await adminSubAccountsApi.tree("u1", { maxDepth: 20, limit: 200 });
    expect(get).toHaveBeenLastCalledWith("/admin/accounts/u1/sub-accounts", { query: { maxDepth: 20, limit: 200 } });
    await adminSubAccountsApi.root("u1");
    expect(get).toHaveBeenLastCalledWith("/admin/accounts/u1/root");
  });
  it("decline is a public POST of e-mail and code", async () => {
    await declineSubAccountApi.decline({ email: "a@b.co", code: "123456" });
    expect(post).toHaveBeenLastCalledWith("/auth/sub-account/decline", { email: "a@b.co", code: "123456" });
  });
  it("the owner list reads the flattened page and keeps the counters that live inside meta", async () => {
    const meta = { page: 1, pageSize: 20, total: 1, totalPages: 1, subAccountCount: 5, cap: 100, pendingCount: 2 };
    get.mockResolvedValue({ data: [{ id: "s1", email: "x@y.co" }], meta });
    const page = await subAccountsApi.list({ page: 1, pageSize: 20 });
    expect(get).toHaveBeenCalledWith("/sub-accounts", { query: { page: 1, pageSize: 20 }, withMeta: true });
    expect(page.items.map((i) => i.id)).toEqual(["s1"]);
    expect(page.meta).toMatchObject({ subAccountCount: 5, cap: 100, pendingCount: 2 });
  });
  it("the invite list reads items and meta the same way (never a token field in the type or the call)", async () => {
    get.mockResolvedValue({ data: [{ id: "i1", status: "PENDING" }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    const page = await subAccountsApi.invites({ page: 1 });
    expect(get).toHaveBeenCalledWith("/sub-accounts/invites", { query: { page: 1 }, withMeta: true });
    expect(page.items[0]).toMatchObject({ id: "i1" });
  });
});

describe("Idempotency-Key per (resource, action)", () => {
  const run = (r: ReturnType<typeof createKeyedRunners>, key: string, body: unknown) => r.forKey(key).run(body, async (_v, k) => k);
  it("withdraw u1 and revoke i1 and create invite never share a key; a retry of the same one does", async () => {
    const r = createKeyedRunners();
    const w = await run(r, "u1:withdraw", "u1");
    const v = await run(r, "i1:revoke", "i1");
    const c = await run(r, "invite:create", null);
    expect(new Set([w, v, c]).size).toBe(3);
    expect(await run(r, "u1:withdraw", "u1")).toBe(w);
    r.forKey("u1:withdraw").onSuccess();
    expect(await run(r, "u1:withdraw", "u1")).not.toBe(w);
  });
  it("the keys the hooks use are distinct per resource and action", async () => {
    const { subAccountOpKey: k } = await import("@/lib/queries/sub-accounts");
    const keys = [k.create, k.withdraw("u1"), k.withdraw("u2"), k.inviteCreate, k.revoke("i1"), k.adminCreate("a1"), k.discard("u1")];
    expect(new Set(keys).size).toBe(keys.length);
    expect(k.withdraw("u1")).toBe(k.withdraw("u1"));
  });
});

describe("subAccountErrorText", () => {
  const err = (status: number, code: string) => new ApiError(status, code, { statusCode: status, message: code, data: { code } } as never);
  it("a 429 on creation is the 'created too many recently' budget text; 404 is 'not found'; the invite 404 keeps its own text; others use the code map", async () => {
    const { subAccountErrorText } = await import("@/lib/queries/sub-accounts");
    const { getTranslation } = await import("@/lib/i18n/get-translation");
    const en = (k: string) => getTranslation("en", k);
    // creation: the hourly budget text; every other operation: the ordinary rate limit text
    expect(subAccountErrorText(err(429, "TOO_MANY_REQUESTS"), "create")).toBe(en("subAccounts.errors.budget"));
    for (const op of [undefined, "other"] as const) expect(subAccountErrorText(err(429, "TOO_MANY_REQUESTS"), op)).toBe(en("subAccounts.errors.tooMany"));
    expect(en("subAccounts.errors.tooMany")).not.toBe(en("subAccounts.errors.budget"));
    expect(subAccountErrorText(err(404, "USER_NOT_FOUND"))).toBe(en("subAccounts.errors.notFound"));
    expect(subAccountErrorText(err(404, "SUB_ACCOUNT_INVITE_NOT_FOUND"))).toBe(en("subAccounts.errors.inviteNotFound"));
    expect(subAccountErrorText(err(409, "SUB_ACCOUNT_LIMIT"))).toBe(en("subAccounts.errors.limit"));
    expect(subAccountErrorText(err(409, "SUB_ACCOUNT_NOT_PENDING"))).toBe(en("subAccounts.errors.notPending"));
    expect(subAccountErrorText(err(409, "SUB_ACCOUNT_DECLINED_RECENTLY"))).toBe(en("subAccounts.errors.declinedRecently"));
    expect(subAccountErrorText(err(409, "EMAIL_ALREADY_IN_USE"))).not.toMatch(/EMAIL_ALREADY/);
    expect(subAccountErrorText(err(409, "ACCOUNT_PENDING_ACTIVATION"))).toBe(en("subAccounts.errors.pendingActivation"));
  });
  it("the cooldown wording does not say that anybody declined", async () => {
    const { getTranslation } = await import("@/lib/i18n/get-translation");
    for (const loc of ["en", "vi", "zh-TW"] as const) {
      const text = getTranslation(loc, "subAccounts.errors.declinedRecently").toLowerCase();
      expect(text, loc).not.toMatch(/declin|từ chối|拒絕/);
    }
  });
});
