import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";

/** The wallet guide lists REFERRAL, TEAM and GLOBAL: the intro must say three, in every language. */
describe("reward type count wording", () => {
  const bodies = (loc: { wallet: { bonusGuide: Record<string, unknown> } }) =>
    ["referralBody", "teamBody", "globalBody"].filter((k) => typeof loc.wallet.bonusGuide[k] === "string");
  it("there are three pillar bodies", () => {
    for (const loc of [en, vi, zh]) expect(bodies(loc)).toHaveLength(3);
  });
  it("the intro says three", () => {
    expect(en.wallet.bonusGuide.intro).toMatch(/^Three reward types/);
    expect(vi.wallet.bonusGuide.intro).toMatch(/^Có ba loại thưởng/);
    expect(zh.wallet.bonusGuide.intro).toMatch(/^共三種獎金/);
  });
  it("no wallet or MLM report copy still counts four reward types", () => {
    const four = /\b(four|4)\b.{0,20}(reward|bonus|type)|bốn loại|4 loại|四種|四个|四個/i;
    const bad: string[] = [];
    const walk = (o: unknown, p: string) => {
      if (typeof o === "string") {
        if ((p.startsWith("wallet.") || p.startsWith("admin.mlm.")) && four.test(o)) bad.push(p);
      } else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
    };
    for (const loc of [en, vi, zh]) walk(loc, "");
    expect(bad).toEqual([]);
  });
});
