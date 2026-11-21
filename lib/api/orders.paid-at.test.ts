import { beforeEach, describe, expect, it, vi } from "vitest";

const patch = vi.fn();
const get = vi.fn();
vi.mock("./client", () => ({
  api: { patch: (...a: unknown[]) => patch(...a), get: (...a: unknown[]) => get(...a) },
}));

import { adminOrdersApi } from "./orders";
import { validatePaidAtEdit } from "@/lib/orders/paid-at";

beforeEach(() => {
  patch.mockReset();
  get.mockReset();
});

describe("adminOrdersApi paid-at", () => {
  it("PATCH /admin/orders/:id/paid-at with Idempotency-Key, paidAt and reason", async () => {
    patch.mockResolvedValue({});
    await adminOrdersApi.editPaidAt("11111111-1111-1111-1111-111111111111", { paidAt: "2026-11-12T02:00:00.000Z", reason: "abc" }, "key-9");
    expect(patch).toHaveBeenCalledWith(
      "/admin/orders/11111111-1111-1111-1111-111111111111/paid-at",
      { paidAt: "2026-11-12T02:00:00.000Z", reason: "abc" },
      { headers: { "Idempotency-Key": "key-9" } },
    );
  });
  it("what the form validates is exactly what is sent (picker value -> request body)", async () => {
    patch.mockResolvedValue({});
    const res = validatePaidAtEdit(
      { local: "2026-11-12T10:00", reason: " Proof shows 12 Nov " },
      { nowMs: Date.parse("2026-11-20T00:00:00Z"), createdAt: "2026-11-01T00:00:00Z" },
    );
    if (!res.ok) throw new Error("expected ok");
    await adminOrdersApi.editPaidAt("o1", res.body, "k");
    expect(patch.mock.calls[0]![1]).toEqual({ paidAt: "2026-11-12T02:00:00.000Z", reason: "Proof shows 12 Nov" });
  });
  it("history is a GET of the history route", async () => {
    get.mockResolvedValue({ items: [] });
    await adminOrdersApi.paidAtHistory("o 1");
    expect(get).toHaveBeenCalledWith("/admin/orders/o%201/paid-at-history");
  });
});
