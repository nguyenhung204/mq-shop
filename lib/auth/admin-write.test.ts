import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/api/types";
import { canSearchUsers, canSetPartialRefund, canWriteDividend, canWriteDividendSlots, canWriteSettings } from "./admin-write";

const u = (...roles: string[]) => ({ roles }) as unknown as AuthUser;

describe("admin write gates", () => {
  it("settings / dividend writes are SUPER_ADMIN only", () => {
    expect(canWriteSettings(u("SUPER_ADMIN"))).toBe(true);
    for (const r of ["ADMIN", "ACCOUNTANT", "SELLER", "BUYER", "CS", "WAREHOUSE"]) {
      expect(canWriteSettings(u(r)), r).toBe(false);
      expect(canWriteDividend(u(r)), r).toBe(false);
    }
    expect(canWriteSettings(null)).toBe(false);
    expect(canWriteSettings(undefined)).toBe(false);
    expect(canWriteSettings({} as AuthUser)).toBe(false);
  });
  it("dividend slots (set / transfer) are for ADMIN and SUPER_ADMIN; rates stay SUPER_ADMIN", () => {
    expect(canWriteDividendSlots(u("ADMIN"))).toBe(true);
    expect(canWriteDividendSlots(u("SUPER_ADMIN"))).toBe(true);
    for (const r of ["ACCOUNTANT", "SELLER", "BUYER", "CS", "WAREHOUSE"]) expect(canWriteDividendSlots(u(r)), r).toBe(false);
    expect(canWriteDividendSlots(null)).toBe(false);
    expect(canWriteDividend(u("ADMIN"))).toBe(false);
  });
  it("partial refund input is for ADMIN / SUPER_ADMIN only", () => {
    expect(canSetPartialRefund(u("ADMIN"))).toBe(true);
    expect(canSetPartialRefund(u("SUPER_ADMIN"))).toBe(true);
    for (const r of ["CS", "WAREHOUSE", "ACCOUNTANT", "SELLER", "BUYER"]) {
      expect(canSetPartialRefund(u(r)), r).toBe(false);
    }
    expect(canSetPartialRefund(u("SELLER", "CS"))).toBe(false);
    expect(canSetPartialRefund(null)).toBe(false);
  });
  it("user search (the account pickers) is for ADMIN / SUPER_ADMIN only", () => {
    expect(canSearchUsers(u("ADMIN"))).toBe(true);
    expect(canSearchUsers(u("SUPER_ADMIN"))).toBe(true);
    for (const r of ["ACCOUNTANT", "SELLER", "BUYER", "CS", "WAREHOUSE"]) expect(canSearchUsers(u(r)), r).toBe(false);
    expect(canSearchUsers(u("ACCOUNTANT", "ADMIN"))).toBe(true);
    expect(canSearchUsers(null)).toBe(false);
    expect(canSearchUsers({} as AuthUser)).toBe(false);
  });
});
