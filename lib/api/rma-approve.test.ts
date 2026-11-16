import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("./client", () => ({
  api: { post: (...a: unknown[]) => post(...a), get: vi.fn(), patch: vi.fn(), delete: vi.fn(), postForm: vi.fn() },
}));

import { adminOrdersApi, orderApi } from "./orders";

beforeEach(() => post.mockReset());

describe("RMA approve clients (UI1)", () => {
  it("admin client forwards refundAmount to the admin route", async () => {
    post.mockResolvedValue({});
    await adminOrdersApi.approveRma("r1", { note: "ok", refundAmount: "250.00" });
    expect(post).toHaveBeenCalledWith("/admin/rma/r1/approve", { note: "ok", refundAmount: "250.00" });
  });
  it("seller client sends only the note: it has no refundAmount at all", async () => {
    post.mockResolvedValue({});
    await orderApi.approveRma("r1", { note: "ok" });
    expect(post).toHaveBeenCalledWith("/rma/r1/approve", { note: "ok" });
    expect(orderApi.approveRma.length).toBeLessThanOrEqual(2);
  });
});
