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
  it("denies SELF scope and anonymous", () => {
    expect(
      canReviewSellerPayout(u({ roles: ["BUYER"], permissionScopes: { PAYOUT_SELLER: "SELF" } })),
    ).toBe(false);
    expect(canReviewSellerPayout(null)).toBe(false);
  });
  it("allows APPROVE scope (accountant checker route), ALL scope and SUPER_ADMIN", () => {
    expect(
      canReviewSellerPayout(u({ roles: ["ACCOUNTANT"], permissionScopes: { PAYOUT_SELLER: "APPROVE" } })),
    ).toBe(true);
    expect(
      canReviewSellerPayout(u({ roles: ["ADMIN"], permissionScopes: { PAYOUT_SELLER: "ALL" } })),
    ).toBe(true);
    expect(canReviewSellerPayout(u({ roles: ["SUPER_ADMIN"] }))).toBe(true);
  });
});
