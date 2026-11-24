import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasDeadBranchMarker, stripComments } from "./test-utils/strip-comments";

/** Wiring guards for the CR 11/11 pages (no component test runner in this repo). */
const raw = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const src = (f: string) => {
  const code = stripComments(raw(f));
  if (hasDeadBranchMarker(code)) throw new Error(`${f}: dead branch marker`);
  return code;
};

describe("settings page wiring (U1)", () => {
  it("is guarded for ADMIN/SUPER_ADMIN and gates writes with canWriteSettings", () => {
    const p = src("app/admin/settings/page.tsx");
    expect(p).toContain('roles={["SUPER_ADMIN", "ADMIN"]}');
    expect(p).toContain("const canWrite = canWriteSettings(user)");
    expect(p).toContain("{canWrite ? (");
    expect(p).toContain("<SettingEditModal");
  });
  it("modal validates before submit and the hook sends the idempotency key", () => {
    expect(src("components/admin/SettingEditModal.tsx")).toContain("validateSettingEdit(setting, { raw, clear, reason, flag })");
    const q = src("lib/queries/settings.ts");
    expect(q).toContain("idempotency.run(vars,");
    expect(q).toContain("adminSettingsApi.update(v.key, v.body, key)");
  });
  it("nav entry is gated by role and permission", () => {
    const nav = src("components/admin/nav.ts");
    const i = nav.indexOf('href: "/admin/settings"');
    expect(i).toBeGreaterThan(-1);
    const block = nav.slice(i, nav.indexOf("},", i));
    expect(block).toContain('permissions: ["CONFIG_SYS"]');
    expect(block).toContain('roles: ["ADMIN", "SUPER_ADMIN"]');
  });
});

describe("dividend rates page wiring (U2)", () => {
  it("is read for ADMIN/ACCOUNTANT/SUPER_ADMIN, form only for SUPER_ADMIN", () => {
    const p = src("app/admin/dividend/rates/page.tsx");
    expect(p).toContain('roles={["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"]}');
    expect(p).toContain("const canWrite = canWriteDividend(user)");
    expect(p).toContain("{canWrite ? (\n          <DividendRateForm");
  });
  it("form validates with validateRateForm and rows have no edit or delete control", () => {
    expect(src("components/admin/dividend/DividendRateForm.tsx")).toContain("validateRateForm({ ratePercent, effectiveDate, reason })");
    const p = src("app/admin/dividend/rates/page.tsx");
    expect(p).not.toMatch(/AdminIconButton|onDelete|onEdit|\.delete\(|\.put\(|\.patch\(/);
  });
  it("write hooks go through the idempotency store", () => {
    const q = src("lib/queries/dividend.ts");
    expect(q).toContain("idempotency.run(vars, run)");
    expect(q).toContain("idempotency.onSuccess()");
    expect(q).toContain("idempotency.onError(e)");
    const a = src("lib/api/dividend.ts");
    expect(a).toContain('api.post<DividendRate>("/admin/dividend/rates", body, idem(idempotencyKey))');
    expect(a).toContain('"/admin/dividend/slots", body, idem(idempotencyKey)');
    expect(a).toContain('"/admin/dividend/slots/transfer", body, idem(idempotencyKey)');
  });
});

describe("dividend slots page wiring (U3)", () => {
  it("forms are for ADMIN and SUPER_ADMIN (MANAGE_DIVIDEND_SLOTS) and receive the server lock flag", () => {
    const p = src("app/admin/dividend/slots/page.tsx");
    expect(p).toContain("const canWrite = canWriteDividendSlots(user)");
    expect(p).toContain("{canWrite && data ? (");
    expect(p).toContain("const locked = Boolean(data?.locked)");
    expect(p).toContain("locked={locked}");
    expect(p).toContain("{canWrite && !locked ? (");
  });
  it("forms validate with the pure helpers before submit", () => {
    const f = src("components/admin/dividend/SlotForms.tsx");
    expect(f).toContain("validateSetSlots({ userId, slots, expiresAtLocal, reason }, ctx)");
    expect(f).toContain("validateTransfer({ fromUserId, toUserId, slots, reason }, ctx)");
  });
  it("a 409 DIVIDEND_QUARTER_LOCKED refreshes the lock state", () => {
    expect(src("lib/queries/dividend.ts")).toContain('e.code === "DIVIDEND_QUARTER_LOCKED"');
  });
});

describe("RMA partial refund wiring (U5, UI1)", () => {
  // CR C1-3 (deliberate inversion of the Phase B rule "the seller never sends refundAmount"): the backend now lets a
  // SELLER of the shop choose the amount, so the seller client, hook and page carry it, behind canSetSellerPartialRefund.
  it("the seller client, hook and page carry refundAmount and open the amount dialog", () => {
    const api = src("lib/api/orders.ts");
    const sellerBlock = api.slice(api.indexOf("export const orderApi"), api.indexOf("export const adminOrdersApi"));
    expect(sellerBlock).toContain("refundAmount?: string");
    expect(api.slice(api.indexOf("export const adminOrdersApi"))).toContain("refundAmount?: string");
    const q = src("lib/queries/orders.ts");
    const sellerHook = q.slice(q.indexOf("export function useShopRmaAction"), q.indexOf("export function useBuyerRmaAction"));
    expect(sellerHook).toContain("refundAmount: input.refundAmount");
    expect(sellerHook).toContain("sendRmaDecision(orderApi");
    const page = src("app/seller/rma/page.tsx");
    expect(page).toContain("<SellerRmaApproveFlow");
    expect(page).toContain("setApproveTarget({ rmaId: r.id, orderId: r.orderId })");
    // the approve button no longer fires the mutation directly
    expect(page).not.toContain('action: "approve"');
  });
  it("the seller dialog is gated by canSetSellerPartialRefund and validates through the shared modal", () => {
    const f = src("components/seller/SellerRmaApproveFlow.tsx");
    expect(f).toContain("const canPartial = canSetSellerPartialRefund(user)");
    expect(f).toContain("<RmaApproveModal");
    expect(f).toContain('action: "approve"');
    expect(f).toContain("refundAmount");
    expect(f).toContain("remainingFromError(e)");
  });
  it("admin pages open the amount dialog only for ADMIN / SUPER_ADMIN (canSetPartialRefund)", () => {
    for (const f of ["app/admin/rma/page.tsx", "app/admin/rma/[id]/page.tsx"]) {
      const p = src(f);
      expect(p, f).toContain("const staffApprove = canSetPartialRefund(user)");
      expect(p, f).toContain("<RmaApproveFlow");
    }
    expect(src("components/admin/RmaApproveFlow.tsx")).toContain("const canPartial = canSetPartialRefund(user)");
  });
  it("modal validates with validateRefundAmount before confirming", () => {
    expect(src("components/admin/RmaApproveModal.tsx")).toContain("validateRefundAmount(amount, cap)");
  });
});

describe("payable amount wiring (U7, R4)", () => {
  it("checkout result, order detail payment block and order list use the payable helpers", () => {
    expect(src("components/cart/CheckoutContent.tsx")).toContain("<PayableLine order={placed.money}");
    expect(src("components/cart/CheckoutContent.tsx")).toContain("payableAmount: order.payableAmount");
    expect(src("components/cart/CheckoutContent.tsx")).not.toContain("formatDisplay(placed.total)");
    const d = src("components/orders/OrderDetailContent.tsx");
    expect(d).toContain("<PayableLine order={order}");
    expect(d).toContain("payableAmount: order.payableAmount");
    expect(src("components/orders/OrdersListContent.tsx")).toContain('formatOrderMoney(o, "total", intlLocale)');
  });
});

describe("R5 UI wiring (U8)", () => {
  it("seller list, admin list and non-buyer order detail show the needs-handling badge", () => {
    expect(src("app/seller/orders/page.tsx")).toContain("<NeedsHandlingBadge order={o}");
    expect(src("app/admin/orders/page.tsx")).toContain("<NeedsHandlingBadge order={o}");
    expect(src("components/orders/OrderDetailContent.tsx")).toContain("{!isBuyer ? <NeedsHandlingBadge order={order} /> : null}");
  });
  it("backups page shows the creator, the scheduled/pruned markers and gates download with canDownloadBackup", () => {
    const p = src("app/admin/backups/page.tsx");
    expect(p).toContain("backupCreator(b)");
    expect(p).toContain("!canDownloadBackup(b) ||");
    expect(p).toContain("isBackupPruned(b)");
    expect(p).not.toContain('b.status !== "SUCCESS" ||');
  });
});

describe("forms keep their input when the server rejects the write", () => {
  it("pages resolve false on error and forms clear only after a non-false result", () => {
    for (const f of ["app/admin/dividend/rates/page.tsx", "app/admin/dividend/slots/page.tsx"]) {
      const p = src(f);
      expect(p, f).toContain("return true;");
      expect(p, f).toContain("return false;");
    }
    expect(src("components/admin/dividend/DividendRateForm.tsx")).toContain("(await onSubmit(res.body)) === false");
    const slots = src("components/admin/dividend/SlotForms.tsx");
    expect((slots.match(/\(await onSubmit\(res\.body\)\) === false/g) ?? []).length).toBe(2);
  });
  it("the checkout estimate note no longer tells the buyer to pay TWD", () => {
    for (const loc of ["en", "vi", "zh-TW"]) {
      const text = (JSON.parse(raw(`lib/i18n/locales/${loc}.json`)) as { checkout: { displayCurrencyNote: string } }).checkout.displayCurrencyNote;
      expect(text, loc).toContain("{currency}");
      expect(text, loc).not.toMatch(/You pay \{amount\}|thanh toán \{amount\} TWD\.|支付 \{amount\} TWD/);
    }
  });
});

describe("call sites of the approve path (the glue the pure tests cannot see)", () => {
  it("modal submit goes through submitApprove with the staff flag, amount, cap and its own onConfirm", () => {
    expect(src("components/admin/RmaApproveModal.tsx")).toContain("submitApprove({ canPartial, amount, cap, onConfirm })");
  });
  it("flow passes the typed amount to the mutation", () => {
    expect(src("components/admin/RmaApproveFlow.tsx")).toContain("decision.mutateAsync(approveVars(target.rmaId, refundAmount))");
  });
  it("the hook sends the variables unchanged through sendRmaDecision to the admin client", () => {
    expect(src("lib/queries/orders.ts")).toContain("mutationFn: (vars: RmaDecisionVars) => sendRmaDecision(adminOrdersApi, vars)");
  });
});

describe("settings hook and labels wiring", () => {
  it("useUpdateSetting rotates the key on success and on error", () => {
    const q = src("lib/queries/settings.ts");
    expect(q).toContain("idempotency.onSuccess()");
    expect(q).toContain("idempotency.onError(e)");
  });
  it("settings page and modal (title and body) read texts through settingTexts", () => {
    const page = src("app/admin/settings/page.tsx");
    expect(page).toContain("settingTexts(t, s)");
    expect(page).toContain("texts(s).label");
    const modal = src("components/admin/SettingEditModal.tsx");
    expect(modal).toContain("settingTexts(t, setting)");
    expect(modal).toContain('t("admin.settings.editTitle", { name: texts.label })');
    expect(modal).toContain("{texts.nullMeaning}");
    expect(modal).not.toMatch(/t\(`admin\.settings\.keys/);
  });
});

describe("account picker gating", () => {
  it("every AccountPicker receives the search flag", () => {
    for (const f of ["components/admin/dividend/SlotForms.tsx", "app/admin/dividend/slots/page.tsx"]) {
      const code = src(f);
      const pickers = code.match(/<AccountPicker[\s\S]*?\/>/g) ?? [];
      expect(pickers.length, f).toBeGreaterThan(0);
      for (const p of pickers) expect(p, f).toMatch(/\bsearch=\{/);
    }
    const page = src("app/admin/dividend/slots/page.tsx");
    expect(page).toContain("const searchUsers = canSearchUsers(user)");
    expect(page.match(/searchUsers=\{searchUsers\}/g)).toHaveLength(2);
  });
  it("the picker query is enabled only through pickerQueryOptions", () => {
    expect(src("components/admin/dividend/AccountPicker.tsx")).toContain("...pickerQueryOptions(search, q)");
  });
});
