import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetSlotsForm, TransferSlotsForm } from "@/components/admin/dividend/SlotForms";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";

const wrap = (child: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(LanguageProvider, null, child),
    ),
  );

const set = (locked: boolean) =>
  wrap(createElement(SetSlotsForm, { quarter: "2026Q4", locked, holdings: [], onSubmit: () => {} }));
const transfer = (locked: boolean) =>
  wrap(createElement(TransferSlotsForm, { quarter: "2026Q4", locked, holdings: [], onSubmit: () => {} }));

const submitDisabled = (html: string) => /<button[^>]*type="submit"[^>]*disabled/.test(html) || /<button[^>]*disabled[^>]*type="submit"/.test(html);

describe("slot forms (rendered)", () => {
  it("open quarter: submit enabled, no locked note", () => {
    for (const html of [set(false), transfer(false)]) {
      expect(submitDisabled(html)).toBe(false);
      expect(html).not.toContain("admin.dividend.slots.lockedNote");
    }
  });
  it("UI3 locked quarter: note shown, every field and the submit are disabled", () => {
    for (const html of [set(true), transfer(true)]) {
      expect(html).toContain("admin.dividend.slots.lockedNote");
      expect(submitDisabled(html)).toBe(true);
      expect(html).not.toMatch(/<input(?![^>]*disabled)[^>]*inputMode/);
      expect(html).not.toMatch(/<textarea(?![^>]*disabled)/);
    }
  });
  it("UI3 locked quarter: EVERY interactive control (expiry, both pickers, buttons) is disabled", () => {
    for (const html of [set(true), transfer(true)]) {
      const controls = (html.match(/<(input|textarea|select|button)\b[^>]*>/g) ?? []).filter((c) => !c.includes('aria-hidden="true"'));
      expect(controls.length).toBeGreaterThanOrEqual(4);
      const enabled = controls.filter((c) => !/\bdisabled\b/.test(c));
      expect(enabled).toEqual([]);
    }
    // the transfer form has two pickers and they are among the controls
    const transferControls = transfer(true).match(/<button[^>]*aria-expanded[^>]*>/g) ?? [];
    expect(transferControls).toHaveLength(2);
  });
  it("open quarter: the pickers are enabled", () => {
    const pickers = transfer(false).match(/<button[^>]*aria-expanded[^>]*>/g) ?? [];
    expect(pickers).toHaveLength(2);
    for (const p of pickers) expect(p).not.toMatch(/\bdisabled\b/);
  });
  it("the set form has an optional expiry and the transfer form has two account pickers", () => {
    expect(set(false)).toContain('type="datetime-local"');
    expect(transfer(false)).toContain("admin.dividend.slots.from");
    expect(transfer(false)).toContain("admin.dividend.slots.to");
  });
});

describe("slot form error keys exist in every locale", () => {
  const fields: Record<string, string[]> = {
    quarter: ["locked", "future", "invalid"],
    userId: ["required", "invalid"],
    fromUserId: ["required", "invalid"],
    toUserId: ["required", "invalid", "same"],
    slots: ["required", "notInteger", "tooLow", "tooHigh", "unchanged", "insufficient", "expiring"],
    expiresAt: ["invalid", "withZero"],
  };
  const lookup = (loc: unknown, key: string) =>
    key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], loc);
  for (const [field, codes] of Object.entries(fields)) {
    for (const code of codes) {
      it(`${field}.${code}`, () => {
        const key = `admin.dividend.slots.errors.${field}.${code}`;
        for (const loc of [en, vi, zh]) expect(typeof lookup(loc, key), key).toBe("string");
      });
    }
  }
});
