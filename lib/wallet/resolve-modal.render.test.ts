import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminResolvePayoutModal } from "@/components/admin/AdminResolvePayoutModal";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import type { PayoutRequestStatus } from "@/lib/api/wallet";

const render = (status: PayoutRequestStatus, payoutGatewayRef?: string | null) =>
  renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(AdminResolvePayoutModal, {
        open: true,
        status,
        payoutGatewayRef,
        onClose: () => {},
        onConfirm: () => {},
      }),
    ),
  );
const radios = (html: string) => (html.match(/type="radio"/g) ?? []).length;

describe("AdminResolvePayoutModal outcomes (rendered)", () => {
  it("PROCESSING without gatewayRef offers both outcomes", () => {
    expect(radios(render("PROCESSING", null))).toBe(2);
    expect(radios(render("PROCESSING"))).toBe(2);
  });
  it("PROCESSING with a gatewayRef offers only COMPLETED", () => {
    expect(radios(render("PROCESSING", "TX1"))).toBe(1);
  });
  it("PAID_UNRECONCILED offers only COMPLETED, with or without gatewayRef", () => {
    expect(radios(render("PAID_UNRECONCILED", null))).toBe(1);
    expect(radios(render("PAID_UNRECONCILED", "TX1"))).toBe(1);
  });
});
