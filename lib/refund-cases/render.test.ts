import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminCaseDetailView, AdminCaseTable, RefundSummaryView } from "@/components/refund-cases/AdminCaseViews";
import { CaseActionModal } from "@/components/refund-cases/CaseActionModal";
import { CaseCard } from "@/components/refund-cases/CaseCard";
import { CaseEventsTimeline } from "@/components/refund-cases/CaseEventsTimeline";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import type { RefundCaseEvent, RefundCaseSummary, RefundCaseView } from "@/lib/api/refund-cases";

const wrap = (node: React.ReactElement) => renderToStaticMarkup(createElement(LanguageProvider, null, node));

const base: RefundCaseView = {
  id: "c1",
  orderId: "o1",
  orderCode: "ORD-1",
  source: "CANCEL",
  sourceId: "x",
  shop: { id: "s1", name: "Shop One" },
  buyer: { id: "b1", name: "Bob", email: "bob@x.test" },
  status: "OPEN",
  isPartial: false,
  amount: "1000.00",
  currency: "TWD",
  display: { amount: "31.00", currency: "SGD", fxRate: 0.031 },
  sellerMarkedAt: null,
  sellerReference: null,
  buyerConfirmedAt: null,
  disputedAt: null,
  closedAt: null,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  ageDays: 5,
  overdue: false,
  actions: [],
};
const card = (c: Partial<RefundCaseView>, side: "buyer" | "seller" = "buyer", busy = false) =>
  wrap(createElement(CaseCard, { c: { ...base, ...c }, side, busy, detail: { isLoading: false, isError: false }, onExpand: () => {}, onAction: () => {} }));

describe("CaseCard buttons come from actions[] only", () => {
  it("seller with MARK_PAID sees mark paid and nothing else", () => {
    const html = card({ actions: ["MARK_PAID"] }, "seller");
    expect(html).toContain("refundCases.action.MARK_PAID");
    expect(html).not.toContain("refundCases.action.CONFIRM");
    expect(html).not.toContain("refundCases.action.DISPUTE");
  });
  it("buyer with CONFIRM and DISPUTE sees both; with only CONFIRM (dispute limit reached) sees no dispute", () => {
    const both = card({ status: "SELLER_MARKED_PAID", actions: ["CONFIRM", "DISPUTE"] });
    expect(both).toContain("refundCases.action.CONFIRM");
    expect(both).toContain("refundCases.action.DISPUTE");
    const limit = card({ status: "BUYER_DISPUTED", actions: ["CONFIRM"] });
    expect(limit).toContain("refundCases.action.CONFIRM");
    expect(limit).not.toContain("refundCases.action.DISPUTE");
  });
  it("self-dealing case has no CONFIRM button and shows the explanation", () => {
    const html = card({ status: "SELLER_MARKED_PAID", selfDealing: true, actions: ["DISPUTE"] });
    expect(html).not.toContain("refundCases.action.CONFIRM");
    expect(html).toContain("refundCases.selfDealing.badge");
    expect(html).toContain("refundCases.selfDealing.note");
  });
  it("a read-only viewer (no actions) sees no action button, only the history toggle", () => {
    const html = card({ actions: [] });
    for (const a of ["MARK_PAID", "CONFIRM", "DISPUTE", "OVERRIDE"]) expect(html).not.toContain(`refundCases.action.${a}`);
    expect(html).toContain("refundCases.showHistory");
  });
  it("OVERRIDE is never a party button even if listed", () => {
    expect(card({ actions: ["OVERRIDE"] })).not.toContain("refundCases.action.OVERRIDE");
  });
  it("busy disables the buttons", () => {
    expect(card({ actions: ["CONFIRM"] }, "buyer", true)).toMatch(/<button[^>]*disabled[^>]*>refundCases\.action\.CONFIRM|disabled=""[^>]*>refundCases\.action\.CONFIRM/);
  });
  it("shows the amount by integer split plus the display amount, partial and overdue badges", () => {
    const html = card({ isPartial: true, overdue: true, amount: "250.50" });
    expect(html).toContain("250.50 TWD");
    expect(html).toContain("31.00 SGD");
    expect(html).toContain("refundCases.kind.partial");
    expect(html).toContain("refundCases.overdue");
  });
  it("buyer side names the shop, seller side names the buyer", () => {
    expect(card({}, "buyer")).toContain("Shop One");
    expect(card({}, "seller")).toContain("Bob");
  });
});

const REASON = "Seller bank statement shows a transfer, internal ticket 4411";
const events: RefundCaseEvent[] = [
  { seq: 1, at: "2026-11-01T00:00:00Z", kind: "CREATED", actorRole: "SYSTEM", onBehalfOf: null, from: null, to: "OPEN", amount: "1000.00", note: null, reference: null },
  { seq: 2, at: "2026-11-02T00:00:00Z", kind: "ADMIN_OVERRIDE", actorRole: "ADMIN", onBehalfOf: null, from: "OPEN", to: "CLOSED", amount: null, note: REASON, reference: "SECRET-REF", actorName: "Ann Admin", actorEmail: "ann@x.test" },
  { seq: 3, at: "2026-11-03T00:00:00Z", kind: "RMA_SYNC", actorRole: "STAFF", onBehalfOf: "BUYER", from: "CLOSED", to: "CLOSED", amount: null, note: REASON, reference: null },
  { seq: 4, at: "2026-11-04T00:00:00Z", kind: "BUYER_DISPUTE", actorRole: "BUYER", onBehalfOf: null, from: "SELLER_MARKED_PAID", to: "BUYER_DISPUTED", amount: null, note: "Nothing arrived", reference: null },
];

describe("CaseEventsTimeline hides the override reason from parties", () => {
  it("buyer/seller see 'Updated by support' and never the reason, reference or actor", () => {
    const html = wrap(createElement(CaseEventsTimeline, { events, viewer: "party" }));
    expect(html).toContain("refundCases.updatedBySupport");
    expect(html).not.toContain("4411");
    expect(html).not.toContain(REASON);
    expect(html).not.toContain("SECRET-REF");
    expect(html).not.toContain("Ann Admin");
    expect(html).not.toContain("ann@x.test");
    // ordinary events still show their note
    expect(html).toContain("Nothing arrived");
  });
  it("staff see the real reason and actor", () => {
    const html = wrap(createElement(CaseEventsTimeline, { events, viewer: "staff" }));
    expect(html).toContain(REASON);
    expect(html).toContain("SECRET-REF");
    expect(html).toContain("Ann Admin");
    expect(html).not.toContain("refundCases.updatedBySupport");
  });
  it("empty history", () => {
    expect(wrap(createElement(CaseEventsTimeline, { events: [], viewer: "party" }))).toContain("refundCases.events.empty");
  });
});

describe("admin views", () => {
  const summary: RefundCaseSummary = {
    asOf: "2026-11-21T00:00:00Z",
    overdueDays: 7,
    counts: { open: 3, awaitingBuyer: 2, disputed: 1, buyerConfirmed: 0, closed: 9, total: 15, overdue: 2 },
    amounts: [{ currency: "TWD", total: "1500.50", open: "300.00", awaitingBuyer: "200.00", disputed: "100.00", buyerConfirmed: "0.00", closed: "900.50", overdue: "250.00" }],
  };
  it("summary shows every counter, the amounts per currency and the overdue rule", () => {
    const html = wrap(createElement(RefundSummaryView, { summary }));
    for (const k of ["open", "awaitingBuyer", "disputed", "buyerConfirmed", "closed", "overdue", "total"]) expect(html).toContain(`refundCases.summary.${k}`);
    expect(html).toContain("1500.50");
    expect(html).toContain("250.00");
    expect(html).toContain("refundCases.summary.overdueRule");
    expect(wrap(createElement(RefundSummaryView, { summary: { ...summary, overdueDays: null } }))).toContain("refundCases.summary.overdueOff");
  });
  it("table is read-only: a link to the detail, no action buttons, self-dealing and overdue flags", () => {
    const html = wrap(createElement(AdminCaseTable, { items: [{ ...base, selfDealing: true, overdue: true, actions: ["OVERRIDE"] }] }));
    expect(html).toContain('href="/admin/refund-cases/c1"');
    expect(html).toContain("refundCases.selfDealing.badge");
    expect(html).toContain("refundCases.overdue");
    expect(html).not.toContain("refundCases.action.");
    expect(html).toContain("bob@x.test");
  });
  it("detail view shows the real override reason, the RMA link and the self-dealing note", () => {
    const html = wrap(
      createElement(AdminCaseDetailView, {
        c: { ...base, selfDealing: true, source: "RMA", events, rma: { id: "r1", status: "REFUND_SENT", hasRefundProof: true } },
      }),
    );
    expect(html).toContain(REASON);
    expect(html).toContain('href="/admin/rma/r1"');
    expect(html).toContain("refundCases.selfDealing.staffNote");
    expect(html).toContain("refundCases.detail.proofYes");
  });
});

const modal = (kind: "markPaid" | "confirm" | "dispute" | "override") =>
  wrap(createElement(CaseActionModal, { open: true, kind, caseId: "c1", currentStatus: "OPEN", onClose: () => {}, onSubmit: () => {} }));

describe("CaseActionModal", () => {
  it("renders nothing when closed", () => {
    expect(wrap(createElement(CaseActionModal, { open: false, kind: "dispute", caseId: "c", currentStatus: "OPEN", onClose: () => {}, onSubmit: () => {} }))).toBe("");
  });
  it("override: status select without the current status, mandatory reason, internal-only hint", () => {
    const html = modal("override");
    expect(html).toContain("<select");
    expect(html).toContain('value="CLOSED"');
    expect(html).not.toContain('value="OPEN"');
    expect(html).toContain("admin.common.reason");
    expect(html).toContain("refundCases.modal.override.internalNote");
  });
  it("dispute: required note and no select, no reference", () => {
    const html = modal("dispute");
    expect(html).toContain("refundCases.modal.noteRequired");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("refundCases.modal.markPaid.reference");
  });
  it("mark paid: reference field and optional note; confirm: optional note only", () => {
    const m = modal("markPaid");
    expect(m).toContain("refundCases.modal.markPaid.reference");
    expect(m).toContain("refundCases.modal.noteOptional");
    const c = modal("confirm");
    expect(c).not.toContain("refundCases.modal.markPaid.reference");
    expect(c).toContain("refundCases.modal.noteOptional");
  });
  it("busy disables the fields", () => {
    const html = wrap(createElement(CaseActionModal, { open: true, kind: "dispute", caseId: "c", currentStatus: "OPEN", busy: true, onClose: () => {}, onSubmit: () => {} }));
    expect(html).toMatch(/<textarea[^>]*disabled/);
    expect(html).toContain("admin.common.working");
  });
});

describe("admin views: formatting details", () => {
  const summary: RefundCaseSummary = {
    asOf: "2026-11-21T00:00:00Z",
    overdueDays: 7,
    counts: { open: 1, awaitingBuyer: 0, disputed: 0, buyerConfirmed: 0, closed: 0, total: 1, overdue: 0 },
    amounts: [{ currency: "TWD", total: "100.00", open: "100.00", awaitingBuyer: "0.00", disputed: "0.00", buyerConfirmed: "0.00", closed: "0.00", overdue: "0.00" }],
  };
  it("summary amounts carry no trailing space", () => {
    const html = wrap(createElement(RefundSummaryView, { summary }));
    expect(html).toContain(">100.00</td>");
    expect(html).not.toMatch(/\d\.\d\d\s+<\/td>/);
  });
  it("the RMA status of a case goes through translateStatus and every RMA status has a label in all locales", async () => {
    const { readFileSync } = await import("node:fs");
    const view = readFileSync(`${__dirname}/../../components/refund-cases/AdminCaseViews.tsx`, "utf8");
    expect(view).toContain('translateStatus(t, "rma", c.rma.status)');
    expect(view).not.toContain("{c.rma.status}");
    const { getTranslation } = await import("@/lib/i18n/get-translation");
    for (const loc of ["en", "vi", "zh-TW"] as const) {
      for (const st of ["REFUND_PENDING", "REFUND_SENT", "COMPLETED", "DISPUTED", "CLOSED"]) {
        const label = getTranslation(loc, `status.rma.${st}`);
        expect(label, `${loc} ${st}`).not.toBe(`status.rma.${st}`);
        expect(label, `${loc} ${st}`).not.toBe(st);
      }
    }
  });
});
