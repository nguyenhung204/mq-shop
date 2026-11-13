import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/api/types";
import { canReviewSellerPayout } from "./payout-access";

const u = (p: Partial<AuthUser>) => p as AuthUser;

describe("canReviewSellerPayout", () => {
  it("denies SELLER with SHOP scope", () => {
    expect(
      canReviewSellerPayout(u({ roles: ["SELLER"], permissionScopes: { PAYOUT_SELLER: "SHOP" } })),
    ).toBe(false);
  });
  it("denies APPROVE scope and anonymous", () => {
    expect(
      canReviewSellerPayout(u({ roles: ["ACCOUNTANT"], permissionScopes: { PAYOUT_SELLER: "APPROVE" } })),
    ).toBe(false);
    expect(canReviewSellerPayout(null)).toBe(false);
  });
  it("allows ALL scope and SUPER_ADMIN", () => {
    expect(
      canReviewSellerPayout(u({ roles: ["ADMIN"], permissionScopes: { PAYOUT_SELLER: "ALL" } })),
    ).toBe(true);
    expect(canReviewSellerPayout(u({ roles: ["SUPER_ADMIN"] }))).toBe(true);
  });
});
