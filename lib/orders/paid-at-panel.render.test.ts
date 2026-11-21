import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaidAtPanelView, type PaidAtPanelViewProps } from "@/components/orders/PaidAtPanelView";
import { LanguageProvider } from "@/components/providers/LanguageProvider";

const base: PaidAtPanelViewProps = {
  paidAt: "2026-11-10T02:00:00.000Z",
  createdAt: "2026-11-01T00:00:00.000Z",
  canEdit: true,
  history: [],
  historyState: "ready",
  onSubmit: () => true,
};
const render = (over: Partial<PaidAtPanelViewProps> = {}) =>
  renderToStaticMarkup(createElement(LanguageProvider, null, createElement(PaidAtPanelView, { ...base, ...over })));

describe("PaidAtPanelView (rendered)", () => {
  it("SUPER_ADMIN gets a date-time picker pre-filled in GMT+8, a reason box and a save button", () => {
    const html = render();
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('value="2026-11-10T10:00"');
    expect(html).toContain("<textarea");
    expect(html).toContain("orders.paidAt.save");
  });
  it("a read-only viewer sees the current date and the history but no form at all", () => {
    const html = render({ canEdit: false });
    expect(html).not.toContain("<form");
    expect(html).not.toContain("datetime-local");
    expect(html).not.toContain("<textarea");
    expect(html).toContain("orders.paidAt.current");
    expect(html).toContain("orders.paidAt.historyEmpty");
  });
  it("lists the history rows with who, why and the old and new date", () => {
    const html = render({
      canEdit: false,
      history: [
        {
          id: "h1",
          orderId: "o1",
          changedBy: "abcdef12-0000-0000-0000-000000000000",
          changedAt: "2026-11-12T01:00:00.000Z",
          oldPaidAt: "2026-11-10T02:00:00.000Z",
          newPaidAt: "2026-11-09T02:00:00.000Z",
          reason: "Customer paid on the 9th",
        },
      ],
    });
    expect(html).toContain("Customer paid on the 9th");
    expect(html).toContain("→");
    expect(html).toContain("orders.paidAt.by");
    expect(html).not.toContain("orders.paidAt.historyEmpty");
  });
  it("shows loading and error states of the history", () => {
    expect(render({ canEdit: false, historyState: "loading" })).toContain("admin.common.loading");
    expect(render({ canEdit: false, historyState: "error" })).toContain("admin.common.failed");
  });
  it("hides the history block when the viewer may not read it", () => {
    expect(render({ history: null })).not.toContain("orders.paidAt.historyTitle");
  });
  it("disables the form while a save is running", () => {
    const html = render({ busy: true });
    expect(html).toContain("disabled");
    expect(html).toContain("admin.common.working");
  });
});
