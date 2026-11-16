import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/locales/en.json";

const ROOT = path.join(__dirname, "..", "..");
const lookup = (key: string): unknown =>
  key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Namespaces added for CR 11/11: every literal t("...") key under them must exist. */
const NAMESPACES = ["admin.settings.", "admin.dividend.", "admin.nav.", "orders.payable.", "toast."];
const CALL = /\bt\(\s*"([A-Za-z0-9_.]+)"/g;

describe("literal translation keys used by the CR 11/11 UI exist", () => {
  const files = ["app", "components", "lib"].flatMap((d) => walk(path.join(ROOT, d)));
  it("resolves every literal key in the new namespaces", () => {
    const missing: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(CALL)) {
        const key = m[1]!;
        if (NAMESPACES.some((ns) => key.startsWith(ns)) && typeof lookup(key) !== "string") {
          missing.push(`${path.relative(ROOT, f)}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
