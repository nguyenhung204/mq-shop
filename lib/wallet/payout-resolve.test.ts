import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";
import {
  canResolvePayoutStatus,
  processResultKind,
  processToast,
  resolveToast,
  validateResolveForm,
} from "./payout-resolve";

describe("payout resolve helpers", () => {
  it("only PROCESSING and PAID_UNRECONCILED are resolvable", () => {
    expect(canResolvePayoutStatus("PROCESSING")).toBe(true);
    expect(canResolvePayoutStatus("PAID_UNRECONCILED")).toBe(true);
    expect(canResolvePayoutStatus("COMPLETED")).toBe(false);
    expect(canResolvePayoutStatus("APPROVED")).toBe(false);
  });

  it("requires gatewayRef to complete a PROCESSING payout", () => {
    const base = { status: "PROCESSING", outcome: "COMPLETED", gatewayRef: " ", note: "bank confirmed" } as const;
    expect(validateResolveForm(base)).toBe("gatewayRefRequired");
    expect(validateResolveForm({ ...base, gatewayRef: "TX1" })).toBeNull();
    expect(validateResolveForm({ ...base, outcome: "FAILED" })).toBeNull();
    expect(validateResolveForm({ ...base, status: "PAID_UNRECONCILED" })).toBeNull();
  });

  it("validates note length and gatewayRef length", () => {
    const base = { status: "PROCESSING", outcome: "FAILED", gatewayRef: "", note: "ok!" } as const;
    expect(validateResolveForm(base)).toBeNull();
    expect(validateResolveForm({ ...base, note: " ab " })).toBe("noteInvalid");
    expect(validateResolveForm({ ...base, note: "x".repeat(501) })).toBe("noteInvalid");
    expect(validateResolveForm({ ...base, gatewayRef: "g".repeat(129) })).toBe("gatewayRefTooLong");
  });

  it("processResultKind table: only an explicit COMPLETED is success", () => {
    const rows: Array<[string | undefined | null, string | undefined | null, string]> = [
      ["COMPLETED", "Payout processed", "success"],
      ["COMPLETED", undefined, "success"],
      ["PAID_UNRECONCILED", "Payout was sent by the gateway but wallet settlement failed", "unreconciled"],
      ["PAID_UNRECONCILED", undefined, "unreconciled"],
      ["PROCESSING", undefined, "processing"],
      ["PAY_FAILED", "Payout payment failed", "failed"],
      ["COMPLETED", "Payout was paid by the gateway but had already been resolved manually; flagged for manual reconcile", "resolvedElsewhere"],
      ["PAY_FAILED", "Payout was paid by the gateway but had already been resolved manually", "resolvedElsewhere"],
      [undefined, undefined, "unknown"],
      [null, null, "unknown"],
      ["", "ok", "unknown"],
      ["APPROVED", "ok", "unknown"],
      ["PENDING", "ok", "unknown"],
      ["REJECTED", "ok", "unknown"],
      ["SOMETHING_NEW", "ok", "unknown"],
    ];
    for (const [status, message, kind] of rows) {
      expect(processResultKind(status, message), `${status}/${message}`).toBe(kind);
    }
  });

  it("processToast: normal 'processed' success ONLY for clean COMPLETED", () => {
    const ok = processToast({ data: { status: "COMPLETED" }, message: "Payout processed" });
    expect(ok).toEqual({ level: "success", key: "toast.walletPayoutProcessed" });
    const bad: Array<Parameters<typeof processToast>[0]> = [
      { data: { status: "PAID_UNRECONCILED" }, message: "flagged PAID_UNRECONCILED" },
      { data: { status: "PROCESSING" } },
      { data: { status: "PAY_FAILED" } },
      { data: { status: "COMPLETED" }, message: "had already been resolved manually; flagged for manual reconcile" },
      { data: { status: "PAY_FAILED" }, message: "had already been resolved manually" },
      { data: {} },
      { data: null },
      {},
      null,
      undefined,
    ];
    for (const res of bad) {
      const t = processToast(res);
      expect(t.key, JSON.stringify(res)).not.toBe("toast.walletPayoutProcessed");
      expect(t.level, JSON.stringify(res)).not.toBe("success");
    }
    expect(processToast({ data: { status: "PAID_UNRECONCILED" } })).toEqual({
      level: "warning",
      key: "toast.walletPayoutUnreconciled",
    });
    expect(processToast({ data: { status: "PAY_FAILED" } }).level).toBe("error");
  });

  it("resolveToast: replay is info, fresh resolve is success", () => {
    expect(resolveToast({ message: "Payout was already resolved" })).toEqual({
      level: "info",
      key: "toast.walletPayoutAlreadyResolved",
    });
    expect(resolveToast({ message: "Payout resolved" })).toEqual({
      level: "success",
      key: "toast.walletPayoutResolved",
    });
    expect(resolveToast(null).level).toBe("success");
  });

  it("every toast key exists in all three locales", () => {
    const keys = [
      "walletPayoutProcessed", "walletPayoutUnreconciled", "walletPayoutPaidAfterResolve",
      "walletPayoutStillProcessing", "walletPayoutPayFailed", "walletPayoutProcessUnknown",
      "walletPayoutAlreadyResolved", "walletPayoutResolved",
    ];
    for (const loc of [en, vi, zh]) {
      for (const k of keys) expect((loc as { toast: Record<string, string> }).toast[k], k).toBeTruthy();
    }
  });
});
