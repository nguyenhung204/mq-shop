import { describe, expect, it } from "vitest";
import { getTranslation } from "@/lib/i18n/get-translation";
import { settingTexts } from "./labels";

const t = (k: string) => getTranslation("en", k);

describe("settingTexts", () => {
  it("known keys use the locale texts", () => {
    const x = settingTexts(t, { key: "maxTotalSlots", description: "api desc", nullMeaning: "api null" });
    expect(x.known).toBe(true);
    expect(x.label).toBe("Maximum total slots");
    expect(x.nullMeaning).toBe("No cap.");
  });
  it("a key added to the backend later falls back to the API text, never a raw i18n key", () => {
    const x = settingTexts(t, { key: "newSetting", description: "api desc", nullMeaning: null });
    expect(x).toEqual({ known: false, label: "newSetting", description: "api desc", nullMeaning: "" });
  });
});
