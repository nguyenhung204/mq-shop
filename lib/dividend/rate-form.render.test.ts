import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DividendRateForm } from "@/components/admin/dividend/DividendRateForm";
import { LanguageProvider } from "@/components/providers/LanguageProvider";

const render = (props: { today?: string; busy?: boolean } = {}) =>
  renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(DividendRateForm, { onSubmit: () => {}, ...props }),
    ),
  );

describe("DividendRateForm (rendered)", () => {
  it("has a rate field, a date field bounded by the server today, a reason box and a submit", () => {
    const html = render({ today: "2026-11-16" });
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('type="date"');
    expect(html).toContain('min="2026-11-16"');
    expect(html).toContain("<textarea");
    expect(html).toContain('type="submit"');
    expect(html).toContain("admin.dividend.rates.submit");
  });
  it("offers no way to edit or delete (immutable)", () => {
    const html = render();
    expect(html).not.toMatch(/delete|remove/i);
  });
  it("disables inputs while busy", () => {
    const html = render({ busy: true });
    expect(html.match(/disabled/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
