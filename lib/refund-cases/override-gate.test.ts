import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverrideButtonView } from "@/components/refund-cases/CaseDetailActions";
import { CaseCard } from "@/components/refund-cases/CaseCard";
import { CaseActionModal } from "@/components/refund-cases/CaseActionModal";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { ApiError } from "@/lib/api/client";
import type { RefundCaseAction, RefundCaseView } from "@/lib/api/refund-cases";
import { canOverrideCase, caseRouteErrorKey, needsRefundProofFirst } from "./model";

const wrap = (n: React.ReactElement) => renderToStaticMarkup(createElement(LanguageProvider, null, n));
const button = (roles: string[], actions: RefundCaseAction[]) =>
  wrap(createElement(OverrideButtonView, { roles, c: { actions }, onClick: () => {} }));

describe("override button per role (the API lists OVERRIDE for every staff reader, the route needs ADMIN / SUPER_ADMIN)", () => {
  const withOverride: RefundCaseAction[] = ["OVERRIDE"];
  it("ADMIN and SUPER_ADMIN see it when the API lists OVERRIDE", () => {
    expect(button(["ADMIN"], withOverride)).toContain("refundCases.action.OVERRIDE");
    expect(button(["SUPER_ADMIN"], withOverride)).toContain("refundCases.action.OVERRIDE");
    expect(button(["BUYER", "ADMIN"], withOverride)).toContain("refundCases.action.OVERRIDE");
  });
  it("CS and ACCOUNTANT never see it, even though actions[] lists OVERRIDE for them", () => {
    expect(button(["CS"], withOverride)).toBe("");
    expect(button(["ACCOUNTANT"], withOverride)).toBe("");
    expect(button(["CS", "ACCOUNTANT"], withOverride)).toBe("");
    expect(button(["WAREHOUSE"], withOverride)).toBe("");
    expect(button(["SELLER"], withOverride)).toBe("");
    expect(button([], withOverride)).toBe("");
  });
  it("an ADMIN does not see it when the API does not list OVERRIDE", () => {
    expect(button(["ADMIN"], [])).toBe("");
    expect(button(["SUPER_ADMIN"], ["CONFIRM"])).toBe("");
  });
  it("canOverrideCase is the same rule and fails closed without a user", () => {
    expect(canOverrideCase({ roles: ["ADMIN"] }, { actions: ["OVERRIDE"] })).toBe(true);
    expect(canOverrideCase({ roles: ["CS"] }, { actions: ["OVERRIDE"] })).toBe(false);
    expect(canOverrideCase(null, { actions: ["OVERRIDE"] })).toBe(false);
    expect(canOverrideCase(undefined, { actions: ["OVERRIDE"] })).toBe(false);
    expect(canOverrideCase({}, { actions: ["OVERRIDE"] })).toBe(false);
  });
});

const apiErr = (status: number, code: string) => new ApiError(status, code, { statusCode: status, message: code, data: { code } } as never);

describe("RMA refusals on the refund case routes are translated", () => {
  it("RMA_NOT_PENDING (missing refund proof) maps to the proof text on both routes", () => {
    expect(caseRouteErrorKey(apiErr(409, "RMA_NOT_PENDING"))).toEqual({ key: "refundCases.errors.rmaProofFirst" });
    expect(caseRouteErrorKey(apiErr(409, "RMA_NOT_PENDING"))).toEqual({ key: "refundCases.errors.rmaProofFirst" });
  });
  it("RMA_ESCALATION_REQUIRED (requires prior SLA escalation) maps to the escalation text", () => {
    expect(caseRouteErrorKey(apiErr(409, "RMA_ESCALATION_REQUIRED"))).toEqual({ key: "refundCases.errors.rmaEscalateFirst" });
    expect(caseRouteErrorKey(apiErr(409, "RMA_ESCALATION_REQUIRED"))).toEqual({ key: "refundCases.errors.rmaEscalateFirst" });
  });
  it("other errors keep their normal mapping; the same codes with another status are not claimed", () => {
    const self = new ApiError(409, "REFUND_CASE_INVALID_TRANSITION", { data: { code: "REFUND_CASE_INVALID_TRANSITION", details: { reason: "SELF_DEALING" } } } as never);
    expect(caseRouteErrorKey(self)).toEqual({ key: "refundCases.errors.selfDealing" });
    expect(caseRouteErrorKey(apiErr(400, "RMA_NOT_PENDING"))).toBeNull();
    expect(caseRouteErrorKey(apiErr(400, "RMA_ESCALATION_REQUIRED"))).toBeNull();
    expect(caseRouteErrorKey(new Error("x"))).toBeNull();
  });
  it("getErrorMessage shows a translated text for the escalation code in all three locales", async () => {
    const { getErrorMessage } = await import("@/lib/queries/utils");
    const out = new Set(["en", "vi", "zh-TW"].map((l) => getErrorMessage(apiErr(409, "RMA_ESCALATION_REQUIRED"), "fallback", l as "en")));
    expect(out.size).toBe(3);
    for (const m of out) expect(m).not.toMatch(/RMA_|fallback/);
  });
});

const base: RefundCaseView = {
  id: "c1", orderId: "o1", orderCode: "ORD-1", source: "RMA", sourceId: "rma-1", shop: { id: "s", name: "S" },
  buyer: { id: "b", name: "B", email: "b@x" }, status: "OPEN", isPartial: false, amount: "10.00", currency: "TWD", display: null,
  sellerMarkedAt: null, sellerReference: null, buyerConfirmedAt: null, disputedAt: null, closedAt: null,
  createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", ageDays: 1, overdue: false, actions: ["MARK_PAID"],
};
const card = (c: Partial<RefundCaseView>, side: "buyer" | "seller") =>
  wrap(createElement(CaseCard, { c: { ...base, ...c }, side, detail: { isLoading: false, isError: false }, onExpand: () => {}, onAction: () => {} }));

describe("seller hint for RMA-sourced cases (hasRefundProof drives it)", () => {
  const rmaOpen = { source: "RMA" as const, status: "OPEN" as const, hasRefundProof: false, actions: [] as RefundCaseAction[] };
  it("an OPEN RMA case without the refund proof shows the hint and the link, even though MARK_PAID is withheld", () => {
    const html = card(rmaOpen, "seller");
    expect(html).toContain("refundCases.rma.hint");
    expect(html).toContain('href="/seller/rma"');
    expect(html).not.toContain("refundCases.action.MARK_PAID");
  });
  it("no hint once the proof exists, for a cancel case (null), for another status or for the buyer", () => {
    expect(card({ ...rmaOpen, hasRefundProof: true, actions: ["MARK_PAID"] }, "seller")).not.toContain("refundCases.rma.hint");
    expect(card({ ...rmaOpen, source: "CANCEL", hasRefundProof: null }, "seller")).not.toContain("refundCases.rma.hint");
    expect(card({ ...rmaOpen, hasRefundProof: undefined }, "seller")).not.toContain("refundCases.rma.hint");
    expect(card({ ...rmaOpen, status: "SELLER_MARKED_PAID" }, "seller")).not.toContain("refundCases.rma.hint");
    expect(card(rmaOpen, "buyer")).not.toContain("refundCases.rma.hint");
  });
  it("needsRefundProofFirst is exactly source RMA, status OPEN, hasRefundProof false", () => {
    expect(needsRefundProofFirst({ source: "RMA", status: "OPEN", hasRefundProof: false })).toBe(true);
    for (const c of [
      { source: "RMA", status: "OPEN", hasRefundProof: true },
      { source: "RMA", status: "OPEN", hasRefundProof: null },
      { source: "RMA", status: "OPEN", hasRefundProof: undefined },
      { source: "CANCEL", status: "OPEN", hasRefundProof: false },
      { source: "RMA", status: "CLOSED", hasRefundProof: false },
    ] as const) expect(needsRefundProofFirst(c as never), JSON.stringify(c)).toBe(false);
  });
});

describe("override dialog for an RMA-linked case", () => {
  const modal = (source?: "CANCEL" | "RMA") =>
    wrap(createElement(CaseActionModal, { open: true, kind: "override", caseId: "c", currentStatus: "OPEN", source, onClose: () => {}, onSubmit: () => {} }));
  it("explains that the change runs through the return request", () => {
    expect(modal("RMA")).toContain("refundCases.modal.override.rmaNote");
    expect(modal("CANCEL")).not.toContain("refundCases.modal.override.rmaNote");
    expect(modal()).not.toContain("refundCases.modal.override.rmaNote");
  });
});
