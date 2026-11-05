import { describe, expect, it } from "vitest";
import { calculateRange, getPageNumbers } from "./pagination";

describe("pagination utils", () => {
  describe("getPageNumbers", () => {
    it("returns empty array when totalPages <= 1", () => {
      expect(getPageNumbers(1, 0)).toEqual([]);
      expect(getPageNumbers(1, 1)).toEqual([]);
    });

    it("returns all pages when totalPages <= 5", () => {
      expect(getPageNumbers(1, 3)).toEqual([1, 2, 3]);
      expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    it("handles start of list with compact ellipsis (5 items max)", () => {
      expect(getPageNumbers(1, 15)).toEqual([1, 2, 3, "...", 15]);
      expect(getPageNumbers(2, 15)).toEqual([1, 2, 3, "...", 15]);
      expect(getPageNumbers(3, 15)).toEqual([1, 2, 3, "...", 15]);
    });

    it("handles end of list with compact ellipsis (5 items max)", () => {
      expect(getPageNumbers(15, 15)).toEqual([1, "...", 13, 14, 15]);
      expect(getPageNumbers(14, 15)).toEqual([1, "...", 13, 14, 15]);
      expect(getPageNumbers(13, 15)).toEqual([1, "...", 13, 14, 15]);
    });

    it("handles middle of list with two ellipses (5 items max)", () => {
      expect(getPageNumbers(4, 15)).toEqual([1, "...", 4, "...", 15]);
      expect(getPageNumbers(8, 15)).toEqual([1, "...", 8, "...", 15]);
      expect(getPageNumbers(12, 15)).toEqual([1, "...", 12, "...", 15]);
    });

    it("never returns more than 5 items when totalPages > 5", () => {
      for (let p = 1; p <= 20; p++) {
        const pages = getPageNumbers(p, 20);
        expect(pages.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("calculateRange", () => {
    it("handles 0 total items", () => {
      expect(calculateRange(1, 8, 0)).toEqual({ from: 0, to: 0 });
    });

    it("calculates exact range for page 1 with 8 items per page", () => {
      expect(calculateRange(1, 8, 120)).toEqual({ from: 1, to: 8 });
    });

    it("calculates exact range for page 2 with 8 items per page", () => {
      expect(calculateRange(2, 8, 120)).toEqual({ from: 9, to: 16 });
    });

    it("caps 'to' at total for the last page with remainder items", () => {
      // 15 pages of 8 = 120, if total = 25:
      // Page 1: 1–8
      // Page 2: 9–16
      // Page 3: 17–24
      // Page 4: 25–25
      expect(calculateRange(4, 8, 25)).toEqual({ from: 25, to: 25 });
    });

    it("handles single page with less than 8 items", () => {
      expect(calculateRange(1, 8, 5)).toEqual({ from: 1, to: 5 });
    });
  });
});

