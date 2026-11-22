import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const get = vi.fn();
vi.mock("@/lib/api/client", async (orig) => {
  const real = await orig<typeof import("@/lib/api/client")>();
  return { ...real, api: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) } };
});

import { adminRefundCasesApi, refundCasesApi } from "@/lib/api/refund-cases";
import { buildCaseSubmit, type CaseFormInput } from "./submit";

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  post.mockResolvedValue({});
  get.mockResolvedValue({ items: [] });
});

const input = (over: Partial<CaseFormInput> = {}): CaseFormInput => ({ note: "", reference: "", reason: "", toStatus: "", ...over });

/** Dialog text -> validated variables -> the call the hook makes (same switch as useRefundCaseAction). */
async function send(res: ReturnType<typeof buildCaseSubmit>) {
  if (!res.ok) return false;
  if (res.kind === "override") {
    await adminRefundCasesApi.override(res.vars.id, { toStatus: res.vars.toStatus, reason: res.vars.reason }, "k-1");
    return true;
  }
  const v = res.vars;
  if (v.action === "markPaid") await refundCasesApi.markPaid(v.id, v.body, "k-1");
  else if (v.action === "confirm") await refundCasesApi.confirm(v.id, v.body, "k-1");
  else await refundCasesApi.dispute(v.id, v.body, "k-1");
  return true;
}

describe("typed text reaches the request body", () => {
  it("seller mark paid: note and reference, with the Idempotency-Key", async () => {
    await send(buildCaseSubmit("markPaid", "c1", input({ note: " sent by bank ", reference: " TX-77 " }), "OPEN"));
    expect(post).toHaveBeenCalledWith("/refund-cases/c1/mark-paid", { note: "sent by bank", reference: "TX-77" }, { headers: { "Idempotency-Key": "k-1" } });
  });
  it("seller mark paid with nothing typed sends an empty body", async () => {
    await send(buildCaseSubmit("markPaid", "c1", input(), "OPEN"));
    expect(post.mock.calls[0]![1]).toEqual({});
  });
  it("buyer confirm and dispute", async () => {
    await send(buildCaseSubmit("confirm", "c2", input({ note: "thanks" }), "SELLER_MARKED_PAID"));
    expect(post).toHaveBeenLastCalledWith("/refund-cases/c2/confirm", { note: "thanks" }, { headers: { "Idempotency-Key": "k-1" } });
    await send(buildCaseSubmit("dispute", "c2", input({ note: "Money never arrived" }), "SELLER_MARKED_PAID"));
    expect(post).toHaveBeenLastCalledWith("/refund-cases/c2/dispute", { note: "Money never arrived" }, { headers: { "Idempotency-Key": "k-1" } });
  });
  it("admin override: toStatus and the mandatory reason, as typed (trimmed)", async () => {
    await send(buildCaseSubmit("override", "c3", input({ toStatus: "CLOSED", reason: "  Bank slip verified  " }), "OPEN"));
    expect(post).toHaveBeenCalledWith("/admin/refund-cases/c3/override", { toStatus: "CLOSED", reason: "Bank slip verified" }, { headers: { "Idempotency-Key": "k-1" } });
  });
  it("a 1000 character reason arrives whole", async () => {
    const reason = "r".repeat(1000);
    await send(buildCaseSubmit("override", "c3", input({ toStatus: "CLOSED", reason }), "OPEN"));
    expect((post.mock.calls[0]![1] as { reason: string }).reason).toHaveLength(1000);
  });
  it("invalid input never reaches the API", async () => {
    for (const [kind, i] of [
      ["dispute", input({ note: "ab" })],
      ["dispute", input()],
      ["override", input({ toStatus: "CLOSED", reason: "" })],
      ["override", input({ toStatus: "", reason: "valid reason" })],
      ["override", input({ toStatus: "OPEN", reason: "valid reason" })],
      ["markPaid", input({ reference: "x".repeat(121) })],
      ["confirm", input({ note: "y".repeat(1001) })],
    ] as const) {
      expect(await send(buildCaseSubmit(kind, "c", i, "OPEN")), `${kind} ${JSON.stringify(i)}`).toBe(false);
    }
    expect(post).not.toHaveBeenCalled();
  });
});

describe("read routes", () => {
  it("lists are read with withMeta (the interceptor flattens the page to data=items + meta)", async () => {
    await refundCasesApi.asBuyer({ status: "OPEN", page: 2, pageSize: 20 });
    expect(get).toHaveBeenLastCalledWith("/refund-cases/as-buyer", { query: { status: "OPEN", page: 2, pageSize: 20 }, withMeta: true });
    await refundCasesApi.asSeller();
    expect(get).toHaveBeenLastCalledWith("/refund-cases/as-seller", { query: undefined, withMeta: true });
    await adminRefundCasesApi.list({ status: "OPEN,CLOSED", overdue: "true", page: 1, pageSize: 20 });
    expect(get).toHaveBeenLastCalledWith("/admin/refund-cases", { query: { status: "OPEN,CLOSED", overdue: "true", page: 1, pageSize: 20 }, withMeta: true });
  });
  it("the real wire shape { data: items[], meta } becomes { items, meta }", async () => {
    const meta = { page: 1, pageSize: 20, total: 2, totalPages: 1 };
    get.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], meta, message: "ok" });
    for (const call of [() => refundCasesApi.asBuyer(), () => refundCasesApi.asSeller(), () => adminRefundCasesApi.list()]) {
      const page = await call();
      expect(page.items.map((i) => i.id)).toEqual(["a", "b"]);
      expect(page.meta).toEqual(meta);
    }
  });
  it("an empty page and the nested { items, meta } shape both work", async () => {
    get.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    expect((await refundCasesApi.asBuyer()).items).toEqual([]);
    get.mockResolvedValue({ data: { items: [{ id: "z" }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } });
    expect((await refundCasesApi.asBuyer()).items.map((i) => i.id)).toEqual(["z"]);
  });
  it("detail and summary are not paged", async () => {
    get.mockResolvedValue({});
    await refundCasesApi.get("a b");
    expect(get).toHaveBeenLastCalledWith("/refund-cases/a%20b");
    await adminRefundCasesApi.summary({ from: "2026-11-01" });
    expect(get).toHaveBeenLastCalledWith("/admin/refund-cases/summary", { query: { from: "2026-11-01" } });
    await adminRefundCasesApi.get("c9");
    expect(get).toHaveBeenLastCalledWith("/admin/refund-cases/c9");
  });
});
