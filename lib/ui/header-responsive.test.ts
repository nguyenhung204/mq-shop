import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * Regression: on a 390px phone the logged-in header overflowed (hamburger right=426) because two
 * controls meant to be `hidden lg:*` were forced visible by a competing display rule:
 *  - `.mq-theme-toggle` (unlayered CSS) set `display:flex`, which beats Tailwind's layered `hidden`;
 *  - RegionSwitcher carried its own `inline-flex`, emitted after `.hidden` in the Tailwind sheet.
 * `.mq-icon-btn` (layer components) already provides inline-flex centring for both.
 */
describe("header controls hidden below lg", () => {
  it(".mq-theme-toggle must not set display (would defeat Tailwind `hidden`)", () => {
    const css = read("app/globals.css");
    const m = css.match(/\n\.mq-theme-toggle\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/\bdisplay\s*:/);
  });

  it("RegionSwitcher must not add its own display utility next to the caller's `hidden`", () => {
    const src = read("components/layout/RegionSwitcher.tsx");
    expect(src).not.toMatch(/mq-icon-btn\s+(inline-flex|flex)\b/);
  });

  it("Header keeps theme/region/language switchers desktop-only", () => {
    const src = read("components/layout/Header.tsx");
    expect(src).toContain('className="hidden lg:inline-flex mq-theme-toggle mq-icon-btn"');
    expect(src).toContain('<RegionSwitcher className="hidden lg:flex" />');
    expect(src).toContain('<LanguageSwitcher className="hidden lg:block" />');
  });
});
