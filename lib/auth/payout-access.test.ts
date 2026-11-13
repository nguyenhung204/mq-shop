import { describe, expect, it } from "vitest";
import type { AuthUser, Role } from "@/lib/api/types";
import {
  canResolveWalletPayout,
  canReviewSellerPayout,
  canShowPayoutResolve,
  canShowSellerPayoutReview,
} from "./payout-access";

type Scope = NonNullable<AuthUser["permissionScopes"]>[string];
const ROLES: Role[] = ["BUYER", "SELLER", "WAREHOUSE", "CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"];
const SCOPES: Array<Scope | undefined> = [undefined, "NONE", "APPROVE", "SELF", "SHOP", "ALL"];

const user = (role: Role, perm: string, scope: Scope | undefined, withScopes = true) =>
  ({
    roles: [role],
    ...(withScopes ? { permissionScopes: scope ? { [perm]: scope } : {} } : {}),
  }) as unknown as AuthUser;

describe("canReviewSellerPayout (role x scope)", () => {
  for (const role of ROLES) {
    for (const scope of SCOPES) {
      const expected = role === "SUPER_ADMIN" || scope === "ALL" || scope === "APPROVE";
      it(`${role} / ${scope ?? "no scope"} -> ${expected}`, () => {
        expect(canReviewSellerPayout(user(role, "PAYOUT_SELLER", scope))).toBe(expected);
      });
    }
    it(`${role} with permissionScopes missing (legacy cache) fails closed except SUPER_ADMIN`, () => {
      expect(canReviewSellerPayout(user(role, "PAYOUT_SELLER", undefined, false))).toBe(
        role === "SUPER_ADMIN",
      );
    });
  }
  it("denies anonymous", () => {
    expect(canReviewSellerPayout(null)).toBe(false);
    expect(canReviewSellerPayout(undefined)).toBe(false);
  });
});

describe("canShowSellerPayoutReview", () => {
  const sa = user("SUPER_ADMIN", "PAYOUT_SELLER", "ALL");
  const seller = user("SELLER", "PAYOUT_SELLER", "SHOP");
  it("only PENDING, with approve permission, for a reviewer", () => {
    expect(canShowSellerPayoutReview(sa, "PENDING", true)).toBe(true);
    expect(canShowSellerPayoutReview(sa, "APPROVED", true)).toBe(false);
    expect(canShowSellerPayoutReview(sa, "PENDING", false)).toBe(false);
  });
  it("hidden for SELLER even when canApprovePermission is true (SHOP scope)", () => {
    expect(canShowSellerPayoutReview(seller, "PENDING", true)).toBe(false);
  });
});

describe("canResolveWalletPayout (role x scope)", () => {
  for (const role of ROLES) {
    for (const scope of SCOPES) {
      const expected = role === "SUPER_ADMIN" || scope === "ALL";
      it(`${role} / ${scope ?? "no scope"} -> ${expected}`, () => {
        expect(canResolveWalletPayout(user(role, "PROCESS_PAYOUT", scope))).toBe(expected);
      });
    }
    it(`${role} without permissionScopes fails closed except SUPER_ADMIN`, () => {
      expect(canResolveWalletPayout(user(role, "PROCESS_PAYOUT", undefined, false))).toBe(
        role === "SUPER_ADMIN",
      );
    });
  }
  it("ACCOUNTANT/ADMIN with only APPROVE_PAYOUT never resolve", () => {
    expect(canResolveWalletPayout(user("ADMIN", "PROCESS_PAYOUT", "APPROVE"))).toBe(false);
    expect(canResolveWalletPayout(null)).toBe(false);
  });
});

describe("canShowPayoutResolve (role x status)", () => {
  const sa = user("SUPER_ADMIN", "PROCESS_PAYOUT", "ALL");
  const admin = user("ADMIN", "PROCESS_PAYOUT", "APPROVE");
  const statuses = [
    "PENDING",
    "APPROVED",
    "COMPLETED",
    "REJECTED",
    "PAY_FAILED",
    "PROCESSING",
    "PAID_UNRECONCILED",
  ] as const;
  for (const st of statuses) {
    const stuck = st === "PROCESSING" || st === "PAID_UNRECONCILED";
    it(`SUPER_ADMIN ${st} -> ${stuck}`, () => expect(canShowPayoutResolve(sa, st)).toBe(stuck));
    it(`ADMIN ${st} -> false`, () => expect(canShowPayoutResolve(admin, st)).toBe(false));
  }
});
