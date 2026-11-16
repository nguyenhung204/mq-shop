import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettingEditModal } from "@/components/admin/SettingEditModal";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import type { SystemSetting } from "@/lib/api/settings";

const setting = (over: Partial<SystemSetting> = {}): SystemSetting => ({
  key: "maxTotalSlots",
  value: 100,
  default: null,
  isDefault: false,
  min: 1,
  max: 1000000,
  nullable: true,
  description: "",
  nullMeaning: null,
  updatedBy: null,
  updatedAt: null,
  ...over,
});

const render = (s: SystemSetting | null, open = true) =>
  renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(SettingEditModal, { open, setting: s, onClose: () => {}, onConfirm: () => {} }),
    ),
  );

describe("SettingEditModal (rendered)", () => {
  it("renders nothing when closed or without a setting", () => {
    expect(render(setting(), false)).toBe("");
    expect(render(null)).toBe("");
  });
  it("shows the value field, the range, a reason box and the clear option for nullable settings", () => {
    const html = render(setting());
    // No locale is chosen in a bare render, so t() echoes the key: this proves which key is used.
    expect(html).toContain("admin.settings.editTitle");
    expect(html).toContain("admin.settings.range");
    expect(html).toContain("<textarea");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("admin.settings.keys.maxTotalSlots.nullMeaning");
  });
  it("hides the clear option when the setting is not nullable", () => {
    expect(render(setting({ nullable: false }))).not.toContain('type="checkbox"');
  });
});
