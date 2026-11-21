import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverrideButtonView } from "@/components/refund-cases/CaseDetailActions";
import { CaseCard } from "@/components/refund-cases/CaseCard";
import { CaseActionModal } from "@/components/refund-cases/CaseActionModal";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { ApiError } from "@/lib/api/client";
import type { RefundCaseAction, RefundCaseView } from "@/lib/api/refund-cases";
import { canOverrideCase, caseRouteErrorKey } from "./model";

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

const rmaErr = (route: string) => new ApiError(409, "RMA_NOT_PENDING", { statusCode: 409, message: "Upload refund transfer proof", data: { code: "RMA_NOT_PENDING" } } as never);

describe("RMA_NOT_PENDING on the refund case routes is translated", () => {
  it("mark-paid (party) and override map to their own keys", () => {
    expect(caseRouteErrorKey(rmaErr("p"), "party")).toEqual({ key: "refundCases.errors.rmaProofFirst" });
    expect(caseRouteErrorKey(rmaErr("o"), "override")).toEqual({ key: "refundCases.errors.rmaEscalateFirst" });
  });
  it("other errors keep their normal mapping; a 400 with the same code is not claimed", () => {
    const self = new ApiError(409, "REFUND_CASE_INVALID_TRANSITION", { data: { code: "REFUND_CASE_INVALID_TRANSITION", details: { reason: "SELF_DEALING" } } } as never);
    expect(caseRouteErrorKey(self, "party")).toEqual({ key: "refundCases.errors.selfDealing" });
    expect(caseRouteErrorKey(new ApiError(400, "RMA_NOT_PENDING", { data: { code: "RMA_NOT_PENDING" } } as never), "party")).toBeNull();
    expect(caseRouteErrorKey(new Error("x"), "override")).toBeNull();
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

describe("seller hint for RMA-sourced cases", () => {
  it("shows the hint with a link to the RMA page when MARK_PAID is offered on an RMA case", () => {
    const html = card({}, "seller");
    expect(html).toContain("refundCases.rma.hint");
    expect(html).toContain('href="/seller/rma"');
  });
  it("no hint for a cancelled-order case, for the buyer, or without MARK_PAID", () => {
    expect(card({ source: "CANCEL" }, "seller")).not.toContain("refundCases.rma.hint");
    expect(card({}, "buyer")).not.toContain("refundCases.rma.hint");
    expect(card({ actions: [] }, "seller")).not.toContain("refundCases.rma.hint");
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
