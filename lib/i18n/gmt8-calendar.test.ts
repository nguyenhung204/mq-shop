import { describe, expect, it } from "vitest";
import {
  formatDateTimeGmt8,
  gmt8DateTimeLocalToIso,
  gmt8DayEndIso,
  gmt8DayStartIso,
  gmt8MonthBounds,
  gmt8YearBackDayBounds,
  isoToGmt8DateTimeLocal,
} from "./gmt8-calendar";

describe("gmt8-calendar", () => {
  it("maps a calendar day to Taipei midnight / end, independent of the JS host TZ", () => {
    expect(gmt8DayStartIso("2026-08-01")).toBe("2026-07-31T16:00:00.000Z");
    expect(gmt8DayEndIso("2026-08-01")).toBe("2026-08-01T15:59:59.999Z");
  });

  it("month bounds follow GMT+8, not UTC, around the 16:00Z rollover", () => {
    const stillJuly = gmt8MonthBounds(new Date("2026-07-31T15:59:59.000Z"));
    expect(stillJuly).toEqual({ start: "2026-07-01", end: "2026-07-31" });

    const august = gmt8MonthBounds(new Date("2026-07-31T16:00:00.000Z"));
    expect(august).toEqual({ start: "2026-08-01", end: "2026-08-31" });
  });

  it("year-back range uses GMT+8 calendar days", () => {
    const bounds = gmt8YearBackDayBounds(new Date("2026-08-24T10:00:00.000Z"));
    expect(bounds.end).toBe("2026-08-24");
    expect(bounds.start).toBe("2025-08-24");
  });

  it("parses datetime-local as GMT+8 (VN and TW admins get the same instant)", () => {
    expect(gmt8DateTimeLocalToIso("2026-08-01T00:00")).toBe(
      "2026-07-31T16:00:00.000Z",
    );
    expect(gmt8DateTimeLocalToIso("2026-08-01T00:00:00")).toBe(
      "2026-07-31T16:00:00.000Z",
    );
    expect(isoToGmt8DateTimeLocal("2026-07-31T16:00:00.000Z")).toBe(
      "2026-08-01T00:00",
    );
  });

  it("round-trips datetime-local through ISO", () => {
    const local = "2026-09-15T13:45";
    expect(isoToGmt8DateTimeLocal(gmt8DateTimeLocalToIso(local))).toBe(local);
  });

  it("formats wall clock in Asia/Taipei", () => {
    const text = formatDateTimeGmt8("2026-07-31T16:00:00.000Z", "en-US");
    expect(text).toMatch(/Aug/);
    expect(text).toMatch(/1/);
  });
});
