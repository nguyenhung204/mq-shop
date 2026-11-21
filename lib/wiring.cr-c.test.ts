import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adminNavItems } from "@/components/admin/nav";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";
import { hasDeadBranchMarker, stripComments } from "./test-utils/strip-comments";

/** Wiring guards for the CR phase C pages (C1 settings/paid-at/seller refund, C2 refunds/export, C3a regions). */
const raw = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const src = (f: string) => {
  const code = stripComments(raw(f));
  if (hasDeadBranchMarker(code)) throw new Error(`${f}: dead branch marker`);
  return code;
};
const get = (loc: unknown, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], loc);

describe("C1 paid-at wiring", () => {
  it("the panel is on the order detail; edit needs canEditPaidAt, history canReadPaidAtHistory", () => {
    expect(src("components/orders/OrderDetailContent.tsx")).toContain("<PaidAtPanel order={order} />");
    const p = src("components/orders/PaidAtPanel.tsx");
    expect(p).toContain("const canEdit = canEditPaidAt(user)");
    expect(p).toContain("const canRead = canReadPaidAtHistory(user)");
    expect(p).toContain("canEdit={canEdit}");
    expect(p).toContain("if (!order.paidAt || !canRead) return null");
  });
  it("the hook sends an Idempotency-Key and maps its errors", () => {
    const q = src("lib/queries/orders.ts");
    expect(q).toContain("idempotency.run(body, (b, key) => adminOrdersApi.editPaidAt(orderId, b, key))");
    expect(q).toContain("paidAtErrorKey(e)");
    const v = src("components/orders/PaidAtPanelView.tsx");
    expect(v).toContain("validatePaidAtEdit(");
  });
});

describe("C1 settings wiring", () => {
  it("the table renders kind-aware values and the history uses the same formatter", () => {
    const p = src("app/admin/settings/page.tsx");
    expect(p).toContain("settingValueText(t, settingKind(s), s.value, s.key)");
    expect(p).toContain("<HistoryPanel settingKey={s.key} kind={settingKind(s)} />");
  });
});

describe("C2 refund case pages", () => {
  it("buyer page: BUYER/SELLER, list hook, shared list", () => {
    const p = src("app/refunds/page.tsx");
    expect(p).toContain("useBuyerRefundCases(status, page)");
    expect(p).toContain('side="buyer"');
  });
  it("seller page: SELLER only", () => {
    const p = src("app/seller/refunds/page.tsx");
    expect(p).toContain("useSellerRefundCases(status, page)");
    expect(p).toContain('side="seller"');
  });
  it("admin list and detail: CS, ACCOUNTANT, ADMIN, SUPER_ADMIN read; override only through actions[]", () => {
    for (const f of ["app/admin/refund-cases/page.tsx", "app/admin/refund-cases/[id]/page.tsx"]) {
      expect(src(f), f).toContain('permissions={["VIEW_REFUND_CASES"]}');
    }
    // behaviour of the override button per role: lib/refund-cases/override-gate.test.ts (render per role)
    const d = src("app/admin/refund-cases/[id]/page.tsx");
    expect(d).toContain("<CaseDetailActions c={data}");
    expect(d).not.toContain('canDo(data, "OVERRIDE")');
    expect(d).toContain('kind="override"');
    // the list page never offers an action
    expect(src("app/admin/refund-cases/page.tsx")).not.toContain("useOverrideRefundCase");
  });
  it("party buttons use actions[] and the cards never import role checks", () => {
    const c = src("components/refund-cases/CaseCard.tsx");
    expect(c).toContain("canDo(c, a)");
    expect(c).not.toContain("useAuth");
    expect(c).toContain("partyEvents(detail.data.events");
  });
  it("every refund case request carries an Idempotency-Key (the key lifecycle itself is tested in lib/refund-cases/keys-and-queue.test.ts)", () => {
    const a = src("lib/api/refund-cases.ts");
    expect(a.match(/idem\(key\)/g)?.length).toBe(4);
  });
  it("getErrorMessage reads the refund case reason before the code", () => {
    const u = src("lib/queries/utils.ts");
    expect(u).toContain("const refundCase = refundCaseErrorKey(e)");
    expect(u.indexOf("refundCaseErrorKey(e)")).toBeLessThan(u.indexOf("if (e instanceof ApiError)"));
  });
});

describe("C2 accounting export page", () => {
  it("ACCOUNTANT/ADMIN/SUPER_ADMIN, validates with buildExportQuery, blocks double clicks", () => {
    const p = src("app/admin/accounting-export/page.tsx");
    expect(p).toContain('permissions={["EXPORT_ACCOUNTING"]}');
    expect(p).toContain("buildExportQuery(form)");
    expect(p).toContain("const busy = summary.isPending || download.isPending");
  });
  it("the download goes through runExportDownload (final #ERROR check), not a bare blob save", () => {
    const q = src("lib/queries/accounting-export.ts");
    expect(q).toContain("runExportDownload({ download: accountingExportApi.download, save: saveBlobAs }");
  });
});

describe("nav", () => {
  const item = (href: string) => adminNavItems.find((i) => i.href === href);
  it("refund tracking is for CS/ACCOUNTANT/ADMIN/SUPER_ADMIN, the export for ACCOUNTANT/ADMIN/SUPER_ADMIN, never SELLER/BUYER/WAREHOUSE", () => {
    expect(item("/admin/refund-cases")!.roles).toEqual(["CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]);
    expect(item("/admin/accounting-export")!.roles).toEqual(["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]);
    for (const href of ["/admin/refund-cases", "/admin/accounting-export"]) {
      for (const r of ["SELLER", "BUYER", "WAREHOUSE"]) expect(item(href)!.roles, `${href} ${r}`).not.toContain(r);
      for (const loc of [en, vi, zh]) expect(typeof get(loc, item(href)!.labelKey)).toBe("string");
    }
    expect(item("/admin/refund-cases")!.permissions).toEqual(["VIEW_REFUND_CASES"]);
    expect(item("/admin/accounting-export")!.permissions).toEqual(["EXPORT_ACCOUNTING"]);
  });
  it("seller and buyer entry points exist", () => {
    expect(src("components/seller/SellerShell.tsx")).toContain('href: "/seller/refunds"');
    expect(src("components/account/AccountDashboard.tsx")).toContain('href="/refunds"');
  });
});

describe("C3a region wiring", () => {
  it("the bridge feeds me.regionCode and the PATCH into the provider", () => {
    const b = src("components/providers/RegionBridge.tsx");
    expect(b).toContain("serverRegionCode={user?.regionCode ?? null}");
    expect(b).toContain("persistRegion={persistRegion}");
    expect(b).toContain("authApi.updateRegion(code, idempotency.keyFor({ regionCode: code }))");
  });
  it("the provider switches through switchRegion (API first) and derives the region from the profile", () => {
    const p = src("components/providers/RegionProvider.tsx");
    expect(p).toContain("await switchRegion({");
    expect(p).toContain("initialRegion(isAuthenticated ? serverRegionCode : null, localRegion)");
  });
  it("register and buyer checkout send the selected region; the admin on-behalf order does not", () => {
    expect(src("components/pages/RegisterContent.tsx")).toContain("regionCode: checkoutRegionCode(region)");
    expect(src("components/cart/CheckoutContent.tsx")).toContain("regionCode: checkoutRegionCode(region)");
    expect(src("app/admin/orders/page.tsx")).not.toContain("regionCode");
  });
  it("the cross-border switch waits for the API before changing the form", () => {
    const c = src("components/cart/CheckoutContent.tsx");
    expect(c).toContain("switched = await setRegion(regionId)");
    expect(c).toContain("if (switchingRegion.current) return;");
    expect(c.indexOf("switched = await setRegion(regionId)")).toBeLessThan(c.indexOf('setValue("shippingAddress.country", newCountry'));
  });
  it("the selection modal waits for setRegion and is busy meanwhile", () => {
    const m = src("components/i18n/RegionSelectionModal.tsx");
    expect(m).toContain("await setRegion(picked)");
    expect(m).toContain("disabled={!picked || busy}");
  });
  it("order detail, admin users and customer detail show the region", () => {
    expect(src("components/orders/OrderDetailContent.tsx")).toContain('t("orders.detail.region"');
    expect(src("app/admin/users/page.tsx")).toContain("u.regionCode");
    expect(src("app/admin/customers/[id]/page.tsx")).toContain("customer.regionCode");
  });
  it("the export page offers the four business regions only", () => {
    const p = src("app/admin/accounting-export/page.tsx");
    expect(p).toContain("BUSINESS_REGION_CODES.map");
  });
  it("no 'us' region is left in the region picker sources", () => {
    for (const f of ["lib/i18n/regions.ts", "components/i18n/RegionFlag.tsx", "components/i18n/RegionSelectionModal.tsx", "components/layout/RegionSwitcher.tsx"]) {
      const code = src(f);
      expect(code, f).not.toMatch(/id:\s*"us"/);
      expect(code, f).not.toMatch(/regionId === "us"/);
    }
  });
});
