import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";
import { NOTIFICATION_TYPE_COPY } from "@/lib/i18n/notifications/copy";

function flatten(o: unknown, prefix = ""): string[] {
  if (o && typeof o === "object" && !Array.isArray(o)) {
    return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      flatten(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

const keysOf = (o: unknown) => new Set(flatten(o));
const diff = (a: Set<string>, b: Set<string>) => [...a].filter((k) => !b.has(k)).sort();

describe("locale key parity (UI5)", () => {
  const E = keysOf(en);
  it("vi has every en key and nothing else", () => {
    const V = keysOf(vi);
    expect(diff(E, V)).toEqual([]);
    expect(diff(V, E)).toEqual([]);
  });
  it("zh-TW has every en key and nothing else", () => {
    const Z = keysOf(zh);
    expect(diff(E, Z)).toEqual([]);
    expect(diff(Z, E)).toEqual([]);
  });
  it("notification copy has the same types in en/vi/zh-TW", () => {
    const e = new Set(Object.keys(NOTIFICATION_TYPE_COPY.en));
    expect(diff(e, new Set(Object.keys(NOTIFICATION_TYPE_COPY.vi)))).toEqual([]);
    expect(diff(new Set(Object.keys(NOTIFICATION_TYPE_COPY.vi)), e)).toEqual([]);
    expect(diff(e, new Set(Object.keys(NOTIFICATION_TYPE_COPY["zh-TW"])))).toEqual([]);
    expect(diff(new Set(Object.keys(NOTIFICATION_TYPE_COPY["zh-TW"])), e)).toEqual([]);
  });
  it("no empty strings in any locale", () => {
    for (const [name, loc] of [["en", en], ["vi", vi], ["zh-TW", zh]] as const) {
      const empties: string[] = [];
      const walk = (o: unknown, p: string) => {
        if (typeof o === "string") {
          if (o.trim() === "") empties.push(p);
        } else if (o && typeof o === "object") {
          for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
        }
      };
      walk(loc, "");
      expect(empties, name).toEqual([]);
    }
  });
});
