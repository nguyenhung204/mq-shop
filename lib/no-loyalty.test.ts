import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { localizeNotification } from "@/lib/notifications/localize";

const ROOT = path.join(__dirname, "..");
const SELF = path.join("lib", "no-loyalty.test.ts");
const NEEDLE = new RegExp(["loy", "alty"].join(""), "i");
const LOCALE_NEEDLES = [["忠", "誠"].join(""), ["全", "勤"].join(""), ["trung", "thành"].join(" ")];
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css)$/;

/** True when the text mentions the retired reward in English, Vietnamese or Chinese. (Strings built by concatenation are not detected.) */
export function mentionsRetiredReward(text: string): boolean {
  return NEEDLE.test(text) || LOCALE_NEEDLES.some((n) => text.toLowerCase().includes(n));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(name)) out.push(full);
  }
  return out;
}

describe("UI4: retired reward is gone from the UI source", () => {
  const files = ["app", "components", "lib"].flatMap((d) => walk(path.join(ROOT, d)));
  it("no source or locale file mentions it", () => {
    const hits = files
      .filter((f) => !f.endsWith(SELF))
      .filter((f) => {
        return mentionsRetiredReward(readFileSync(f, "utf8"));
      })
      .map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });
  it("an old stored notification of the retired type still renders from the server copy", () => {
    const out = localizeNotification(
      { type: ["COMMISSION", "LOY", "ALTY", "CREDITED"].join("_"), title: "Server title", body: "Server body", meta: null },
      "en",
    );
    expect(out).toEqual({ title: "Server title", body: "Server body" });
  });
});

describe("the guard itself", () => {
  it("detects every spelling and the file kinds it scans", () => {
    expect(mentionsRetiredReward(["Loy", "alty bonus"].join(""))).toBe(true);
    expect(mentionsRetiredReward(["全", "勤獎"].join(""))).toBe(true);
    expect(mentionsRetiredReward(["忠", "誠度"].join(""))).toBe(true);
    expect(mentionsRetiredReward(["Trung", " Thành"].join(""))).toBe(true);
    expect(mentionsRetiredReward("Referral, team and global rewards")).toBe(false);
    for (const f of ["a.js", "a.jsx", "a.ts", "a.tsx", "a.json", "a.mjs"]) expect(SOURCE_EXT.test(f), f).toBe(true);
    expect(SOURCE_EXT.test("a.png")).toBe(false);
  });
});
