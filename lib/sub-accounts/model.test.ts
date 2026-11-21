import { describe, expect, it } from "vitest";
import {
  atCap,
  buildInviteLink,
  canRevoke,
  counters,
  inviteReveal,
  inviteTokenFromQuery,
  isPendingAccount,
  registerReferral,
  treeRows,
  validateCreate,
  validateDecline,
} from "./model";

const ok = (over: Partial<Parameters<typeof validateCreate>[0]> = {}, admin = false) =>
  validateCreate({ email: "a@b.co", fullName: "", regionCode: "", reason: "", ...over }, admin);
const errs = (r: ReturnType<typeof validateCreate>) => (r.ok ? [] : r.errors.map((e) => `${e.field}:${e.code}`));

describe("validateCreate", () => {
  it("sends only the e-mail when nothing else was typed (strict body: no empty fields)", () => {
    expect(ok()).toEqual({ ok: true, body: { email: "a@b.co" } });
  });
  it("trims, uppercases the region and keeps the name", () => {
    expect(ok({ email: "  X@Y.com ", fullName: "  Ann ", regionCode: " vn " })).toEqual({
      ok: true,
      body: { email: "X@Y.com", fullName: "Ann", regionCode: "VN" },
    });
  });
  it("e-mail: required, shape, 320 characters at most", () => {
    expect(errs(ok({ email: "" }))).toEqual(["email:required"]);
    expect(errs(ok({ email: "   " }))).toEqual(["email:required"]);
    for (const bad of ["abc", "a@b", "a b@c.de", "@c.de", "a@.de"]) expect(errs(ok({ email: bad })), bad).toEqual(["email:invalid"]);
    const local = "a".repeat(320 - "@b.co".length);
    expect(ok({ email: `${local}@b.co` }).ok).toBe(true);
    expect(errs(ok({ email: `${local}a@b.co` }))).toEqual(["email:tooLong"]);
  });
  it("name: 200 characters at most, no NUL", () => {
    expect(ok({ fullName: "n".repeat(200) }).ok).toBe(true);
    expect(errs(ok({ fullName: "n".repeat(201) }))).toEqual(["fullName:tooLong"]);
    expect(errs(ok({ fullName: "a\u0000b" }))).toEqual(["fullName:invalid"]);
  });
  it("region must be one of TW VN MY SG (US and junk are refused)", () => {
    for (const r of ["TW", "vn", "My", "sg"]) expect(ok({ regionCode: r }).ok, r).toBe(true);
    for (const r of ["US", "XX", "T"]) expect(errs(ok({ regionCode: r })), r).toEqual(["regionCode:invalid"]);
  });
  it("admin path: the reason is mandatory, 3..500, trimmed, and goes into the body", () => {
    expect(errs(ok({}, true))).toEqual(["reason:required"]);
    expect(errs(ok({ reason: "ab" }, true))).toEqual(["reason:tooShort"]);
    expect(errs(ok({ reason: "x".repeat(501) }, true))).toEqual(["reason:tooLong"]);
    expect(ok({ reason: "  Client request 42  " }, true)).toEqual({ ok: true, body: { email: "a@b.co", reason: "Client request 42" } });
    expect(ok({ reason: "x".repeat(500) }, true).ok).toBe(true);
  });
  it("owner path never sends a reason even if one was typed", () => {
    expect(ok({ reason: "ignored" }, false)).toEqual({ ok: true, body: { email: "a@b.co" } });
  });
  it("collects every problem at once", () => {
    expect(errs(ok({ email: "x", fullName: "a\u0000", regionCode: "US" }))).toEqual(["email:invalid", "fullName:invalid", "regionCode:invalid"]);
  });
});

describe("invite link and token", () => {
  it("the link is the documented /register?invite=<token>, token URL-encoded, no double slash", () => {
    expect(buildInviteLink("https://shop.example.com", "abc123")).toBe("https://shop.example.com/register?invite=abc123");
    expect(buildInviteLink("https://shop.example.com/", "a/b+c=")).toBe("https://shop.example.com/register?invite=a%2Fb%2Bc%3D");
  });
  it("the register page reads ?invite= (trimmed, at most 64 characters, else none)", () => {
    expect(inviteTokenFromQuery(" tok ")).toBe("tok");
    expect(inviteTokenFromQuery("t".repeat(64))).toBe("t".repeat(64));
    expect(inviteTokenFromQuery("t".repeat(65))).toBeUndefined();
    expect(inviteTokenFromQuery("")).toBeUndefined();
    expect(inviteTokenFromQuery(null)).toBeUndefined();
    expect(inviteTokenFromQuery(undefined)).toBeUndefined();
  });
  it("an invite and a referral code are never sent together (the invite wins)", () => {
    expect(registerReferral("tok", "REF1")).toEqual({ inviteToken: "tok" });
    expect(registerReferral(undefined, "REF1")).toEqual({ referrerCode: "REF1" });
    expect(registerReferral(undefined, undefined)).toEqual({});
  });
  it("a creation answer with a token reveals it once; a replay (token null) never does", () => {
    expect(inviteReveal({ token: "secret" })).toEqual({ kind: "token", token: "secret" });
    expect(inviteReveal({ token: null })).toEqual({ kind: "replayed" });
    expect(inviteReveal({ token: "" })).toEqual({ kind: "replayed" });
    expect(inviteReveal(undefined)).toEqual({ kind: "none" });
  });
  it("only an open invite can be revoked", () => {
    expect(canRevoke("PENDING")).toBe(true);
    for (const s of ["USED", "REVOKED", "EXPIRED"] as const) expect(canRevoke(s), s).toBe(false);
  });
});

describe("counters", () => {
  it("n of cap and the pending count, with the default cap when the API sent none", () => {
    expect(counters({ page: 1, pageSize: 20, total: 3, totalPages: 1, subAccountCount: 7, cap: 100, pendingCount: 2 })).toEqual({ used: 7, cap: 100, pending: 2 });
    expect(counters(undefined)).toEqual({ used: 0, cap: 100, pending: 0 });
  });
  it("atCap is >=", () => {
    expect(atCap({ used: 99, cap: 100 })).toBe(false);
    expect(atCap({ used: 100, cap: 100 })).toBe(true);
    expect(atCap({ used: 101, cap: 100 })).toBe(true);
  });
  it("pending status", () => {
    expect(isPendingAccount("PENDING_ACTIVATION")).toBe(true);
    expect(isPendingAccount("ACTIVE")).toBe(false);
    expect(isPendingAccount(null)).toBe(false);
  });
});

describe("validateDecline", () => {
  it("needs an e-mail and exactly 6 digits", () => {
    expect(validateDecline({ email: " a@b.co ", code: " 123456 " })).toEqual({ ok: true, body: { email: "a@b.co", code: "123456" } });
    expect(validateDecline({ email: "x", code: "12345" })).toEqual({ ok: false, errors: ["email", "code"] });
    for (const c of ["1234567", "12345a", "", "12 456"]) expect(validateDecline({ email: "a@b.co", code: c }), c).toEqual({ ok: false, errors: ["code"] });
  });
});

describe("treeRows", () => {
  const row = (id: string, depth: number, createdAt: string) => ({
    id, email: `${id}@x.co`, fullName: null, status: "ACTIVE", regionCode: "TW", subAccountCount: 0, createdAt, parentAccountId: "p", depth,
  });
  it("orders parent-first and indents relative to the shallowest row", () => {
    const rows = treeRows({ items: [row("c", 3, "2026-01-03"), row("a", 2, "2026-01-02"), row("b", 2, "2026-01-01")] });
    expect(rows.map((r) => [r.id, r.indent])).toEqual([["b", 0], ["a", 0], ["c", 1]]);
  });
  it("is stable for an empty tree", () => {
    expect(treeRows({ items: [] })).toEqual([]);
  });
});
