import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";
import { stripComments } from "@/lib/test-utils/strip-comments";

const page = stripComments(readFileSync(path.join(__dirname, "../../app/admin/dividend/report/page.tsx"), "utf8"));
const get = (loc: unknown, key: string) =>
  key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], loc);

describe("dividend report page (U4)", () => {
  it("is read-only: no mutation hooks, no write calls, no forms", () => {
    expect(page).not.toMatch(/useMutation|\.post\(|\.put\(|\.patch\(|\.delete\(|<form|<button/);
  });
  it("always states it is a preview and nothing is paid, and shows the remainder as its own row", () => {
    expect(page).toContain('t("admin.dividend.report.previewNotice")');
    expect(page).toContain('data-row="remainder"');
    expect(page).toContain('data-row="refunds-after-lock"');
  });
  it("labels the remainder in all three languages, vi with the client's wording", () => {
    expect(get(vi, "admin.dividend.report.remainderLabel")).toBe("khoản thu từ tính toán chênh lệch");
    expect(typeof get(en, "admin.dividend.report.remainderLabel")).toBe("string");
    expect(typeof get(zh, "admin.dividend.report.remainderLabel")).toBe("string");
    expect(get(en, "admin.dividend.report.remainderLabel")).not.toBe(get(vi, "admin.dividend.report.remainderLabel"));
  });
  it("the preview notice says nothing is paid in every language", () => {
    expect(get(en, "admin.dividend.report.previewNotice")).toMatch(/nothing is paid/i);
    expect(get(vi, "admin.dividend.report.previewNotice")).toMatch(/không có khoản nào được chi trả/i);
    expect(get(zh, "admin.dividend.report.previewNotice")).toContain("不會發放");
  });
});
