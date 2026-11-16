import { describe, expect, it } from "vitest";
import { currentQuarter, isQuarterLabel, isRealDay, quarterOptions, shiftQuarter, todayGmt8 } from "./dates";

describe("todayGmt8", () => {
  it("rolls to the next Taipei day at 16:00Z", () => {
    expect(todayGmt8(new Date("2026-11-16T15:59:59.999Z"))).toBe("2026-11-16");
    expect(todayGmt8(new Date("2026-11-16T16:00:00.000Z"))).toBe("2026-11-17");
  });
  it("handles year end and leap day", () => {
    expect(todayGmt8(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
    expect(todayGmt8(new Date("2028-02-28T16:00:00Z"))).toBe("2028-02-29");
  });
});

describe("isRealDay", () => {
  it("accepts real days and rejects impossible ones", () => {
    expect(isRealDay("2028-02-29")).toBe(true);
    expect(isRealDay("2026-02-29")).toBe(false);
    expect(isRealDay("2026-13-01")).toBe(false);
    expect(isRealDay("2026-04-31")).toBe(false);
    expect(isRealDay("2026-4-1")).toBe(false);
    expect(isRealDay("")).toBe(false);
  });
});

describe("quarters (GMT+8)", () => {
  it("current quarter respects the Taipei month boundary", () => {
    expect(currentQuarter(new Date("2026-09-30T15:59:59Z"))).toBe("2026Q3");
    expect(currentQuarter(new Date("2026-09-30T16:00:00Z"))).toBe("2026Q4");
    expect(currentQuarter(new Date("2026-12-31T16:00:00Z"))).toBe("2027Q1");
  });
  it("shifts across year boundaries", () => {
    expect(shiftQuarter("2026Q1", -1)).toBe("2025Q4");
    expect(shiftQuarter("2026Q4", 1)).toBe("2027Q1");
    expect(shiftQuarter("2026Q2", 0)).toBe("2026Q2");
    expect(shiftQuarter("bad", 1)).toBeNull();
  });
  it("builds options newest first and all are valid labels", () => {
    const opts = quarterOptions(new Date("2026-11-16T00:00:00Z"), 2, 1);
    expect(opts).toEqual(["2027Q1", "2026Q4", "2026Q3", "2026Q2"]);
    expect(opts.every(isQuarterLabel)).toBe(true);
  });
  it("validates labels", () => {
    expect(isQuarterLabel("2026Q4")).toBe(true);
    for (const b of ["2026Q5", "2026Q0", "26Q4", "2026q4", "2026-Q4"]) expect(isQuarterLabel(b), b).toBe(false);
  });
});
