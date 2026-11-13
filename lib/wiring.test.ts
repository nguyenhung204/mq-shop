import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The repo has no component test runner (no jsdom / testing-library). These
 * guard the wiring between pages/components and the unit-tested pure helpers:
 * the page must keep calling the helper that carries the rule.
 */
const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");

describe("UI wiring to tested helpers", () => {
  it("seller payout list/detail gate approve/reject with canShowSellerPayoutReview", () => {
    for (const f of ["app/admin/payouts/page.tsx", "app/admin/payouts/[id]/page.tsx"]) {
      expect(src(f), f).toContain("canShowSellerPayoutReview(user, payout.status, canApprovePayout)");
    }
  });
  it("wallet payout list/detail gate Resolve with canShowPayoutResolve", () => {
    expect(src("app/admin/wallet/payouts/page.tsx")).toContain("canShowPayoutResolve(user, row.status)");
    expect(src("app/admin/wallet/payouts/[id]/page.tsx")).toContain("canShowPayoutResolve(user, payout.status)");
  });
  it("process / resolve hooks pick toasts via the pure helpers", () => {
    const q = src("lib/queries/wallet.ts");
    expect(q).toContain("processToast(res)");
    expect(q).toContain("resolveToast(res)");
    expect(q).not.toContain('toast.success(tt("toast.walletPayoutProcessed"))');
  });
  it("adminWalletPayoutApi.process/resolve read the response message (withMeta)", () => {
    const a = src("lib/api/wallet.ts");
    expect((a.match(/withMeta: true/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(src("lib/api/client.ts")).toContain("message: json.message");
  });
  it("order detail lines use formatOrderLineMoney, not the order total", () => {
    const c = src("components/orders/OrderDetailContent.tsx");
    expect(c).toContain("formatOrderLineMoney(order, lineTwd, intlLocale)");
    expect(c).toContain("formatLineAmount(item.lineTotal)");
    expect(c).not.toContain("formatOrderAmount(item.lineTotal)");
  });
  it("commission page and P2P use the display helpers", () => {
    const c = src("components/wallet/WalletCommissions.tsx");
    expect(c).toContain('commissionAmounts(row, t("common.pointUnit")).main');
    expect(c).toContain('commissionAmounts(row, t("common.pointUnit")).twd');
    expect(c).not.toContain("row.payoutAmount");
    const p2p = src("components/wallet/WalletP2p.tsx");
    expect(p2p).toContain("transferPreviewLabel(preview)");
    expect(p2p).toContain("{ email: email.trim() }");
    expect(p2p).not.toContain("preview.email");
  });
});
