import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RmaApproveModal } from "@/components/admin/RmaApproveModal";
import { LanguageProvider } from "@/components/providers/LanguageProvider";

const render = (props: Partial<Parameters<typeof RmaApproveModal>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(RmaApproveModal, {
        open: true,
        canPartial: true,
        orderTotalCents: 100000,
        onClose: () => {},
        onConfirm: () => {},
        ...props,
      }),
    ),
  );

describe("RmaApproveModal (rendered)", () => {
  it("renders nothing when closed", () => {
    expect(render({ open: false })).toBe("");
  });
  it("staff get the optional amount input, defaulting to the full order total as placeholder", () => {
    const html = render();
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('placeholder="1000.00"');
    expect(html).toContain("admin.rmaPage.approveModal.totalHint");
    expect(html).toContain("admin.rmaPage.approveModal.fullNote");
    expect(html).toContain("admin.rmaPage.approveModal.confirmFull");
  });
  it("uses the server-reported remaining amount as the cap once known", () => {
    const html = render({ remainingCents: 74950 });
    expect(html).toContain('placeholder="749.50"');
    expect(html).toContain("admin.rmaPage.approveModal.remainingHint");
  });
  it("waits for the order total before showing a cap", () => {
    const html = render({ orderTotalCents: null });
    expect(html).toContain("admin.rmaPage.approveModal.loadingTotal");
    expect(html).not.toContain("placeholder=");
  });
  it("a partial amount shows the partial wording and button; the full remaining amount does not", () => {
    const partial = render({ defaultAmount: "250" });
    expect(partial).toContain("admin.rmaPage.approveModal.partialNote");
    expect(partial).toContain("admin.rmaPage.approveModal.confirmPartial");
    expect(partial).not.toContain("admin.rmaPage.approveModal.confirmFull");
    const full = render({ defaultAmount: "1000" });
    expect(full).toContain("admin.rmaPage.approveModal.confirmFull");
    expect(full).not.toContain("admin.rmaPage.approveModal.confirmPartial");
  });
  it("busy: input and submit are disabled so the approve cannot be sent twice", () => {
    const html = render({ busy: true });
    expect(html).toMatch(/<input[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled|<button[^>]*disabled[^>]*type="submit"/);
    expect(html).toContain("admin.common.working");
    const idle = render();
    expect(idle).not.toMatch(/<input[^>]*disabled/);
  });
  it("UI1: without partial permission there is no amount input at all", () => {
    const html = render({ canPartial: false });
    expect(html).not.toContain("<input");
    expect(html).not.toContain("amountLabel");
    expect(html).toContain("admin.rmaPage.approveModal.fullNote");
  });
  it("shows the display-currency equivalent only for a typed amount, and only when a hint is given", () => {
    const hint = (c: number) => `${c} SGD`;
    const partial = render({ defaultAmount: "250", displayHint: hint });
    expect(partial).toContain("admin.rmaPage.approveModal.displayEquivalent");
    expect(render({ defaultAmount: "250" })).not.toContain("displayEquivalent");
    expect(render({ displayHint: hint })).not.toContain("displayEquivalent");
    expect(render({ canPartial: false, displayHint: hint })).not.toContain("displayEquivalent");
  });
});
