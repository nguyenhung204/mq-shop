import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { localizeNotification } from "@/lib/notifications/localize";

const ROOT = path.join(__dirname, "..");
const SELF = path.join("lib", "no-loyalty.test.ts");
const NEEDLE = new RegExp(["loy", "alty"].join(""), "i");
const LOCALE_NEEDLES = [["忠", "誠"].join(""), ["trung", "thành"].join(" ")];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|json|css|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

describe("UI4: retired reward is gone from the UI source", () => {
  const files = ["app", "components", "lib"].flatMap((d) => walk(path.join(ROOT, d)));
  it("no source or locale file mentions it", () => {
    const hits = files
      .filter((f) => !f.endsWith(SELF))
      .filter((f) => {
        const text = readFileSync(f, "utf8");
        return NEEDLE.test(text) || LOCALE_NEEDLES.some((n) => text.toLowerCase().includes(n));
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
