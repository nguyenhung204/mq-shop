import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const patch = vi.fn();
vi.mock("./client", () => ({
  api: { post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a), get: vi.fn() },
}));

import { authApi } from "./auth";
import { orderApi, adminOrdersApi, type AdminCheckoutRequest } from "./orders";

beforeEach(() => {
  post.mockReset();
  patch.mockReset();
});

describe("region API contract", () => {
  it("PATCH /users/me/region with the Idempotency-Key header and the upper-case code", async () => {
    patch.mockResolvedValue({});
    await authApi.updateRegion("VN", "key-5");
    expect(patch).toHaveBeenCalledWith("/users/me/region", { regionCode: "VN" }, { headers: { "Idempotency-Key": "key-5" } });
  });
  it("register forwards regionCode", async () => {
    post.mockResolvedValue({});
    await authApi.register({ email: "a@b.c", password: "12345678", regionCode: "SG" });
    expect(post.mock.calls[0]![0]).toBe("/auth/register");
    expect(post.mock.calls[0]![1]).toMatchObject({ regionCode: "SG" });
  });
  it("buyer checkout forwards regionCode untouched", async () => {
    post.mockResolvedValue({});
    await orderApi.checkout({ regionCode: "MY", items: [], shippingAddress: {} as never, paymentMethod: "OFF_PLATFORM" }, "k");
    expect(post.mock.calls[0]![1]).toMatchObject({ regionCode: "MY" });
  });
  it("the admin on-behalf checkout type has no regionCode (the API uses the buyer's own region)", () => {
    // @ts-expect-error regionCode is not part of the admin on-behalf request
    const body: AdminCheckoutRequest = { buyerId: "b", items: [], shippingAddress: {} as never, paymentMethod: "OFF_PLATFORM", regionCode: "VN" };
    expect(adminOrdersApi.checkout).toBeTypeOf("function");
    expect(body).toBeTruthy();
  });
});
