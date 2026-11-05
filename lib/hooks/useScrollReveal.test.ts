import { describe, expect, it } from "vitest";
import { calculateStaggerDelay } from "./useScrollReveal";

describe("calculateStaggerDelay", () => {
  it("returns 0 when index is undefined", () => {
    expect(calculateStaggerDelay(undefined)).toBe(0);
  });

  it("uses default baseDelay = 50ms and 4 columns", () => {
    expect(calculateStaggerDelay(0)).toBe(0);
    expect(calculateStaggerDelay(1)).toBe(50);
    expect(calculateStaggerDelay(2)).toBe(100);
    expect(calculateStaggerDelay(3)).toBe(150);
    expect(calculateStaggerDelay(4)).toBe(0);
  });

  it("calculates sequential stagger from left to right across 4 columns", () => {
    expect(calculateStaggerDelay(0, 75, 4)).toBe(0);
    expect(calculateStaggerDelay(1, 75, 4)).toBe(75);
    expect(calculateStaggerDelay(2, 75, 4)).toBe(150);
    expect(calculateStaggerDelay(3, 75, 4)).toBe(225);
  });

  it("wraps around per row to prevent excessive delays on large collections", () => {
    // Row 2
    expect(calculateStaggerDelay(4, 75, 4)).toBe(0);
    expect(calculateStaggerDelay(5, 75, 4)).toBe(75);
    expect(calculateStaggerDelay(6, 75, 4)).toBe(150);
    expect(calculateStaggerDelay(7, 75, 4)).toBe(225);

    // Large index e.g. item 48
    expect(calculateStaggerDelay(48, 75, 4)).toBe(0);
    expect(calculateStaggerDelay(51, 75, 4)).toBe(225);
  });

  it("supports custom column counts and base delays", () => {
    // Mobile 2 columns with 80ms
    expect(calculateStaggerDelay(0, 80, 2)).toBe(0);
    expect(calculateStaggerDelay(1, 80, 2)).toBe(80);
    expect(calculateStaggerDelay(2, 80, 2)).toBe(0);
    expect(calculateStaggerDelay(3, 80, 2)).toBe(80);

    // Tablet 3 columns with 70ms
    expect(calculateStaggerDelay(0, 70, 3)).toBe(0);
    expect(calculateStaggerDelay(1, 70, 3)).toBe(70);
    expect(calculateStaggerDelay(2, 70, 3)).toBe(140);
    expect(calculateStaggerDelay(3, 70, 3)).toBe(0);
  });
});

