import { describe, expect, it } from "vitest";
import { validateRateForm } from "./rate-form";

const NOW = new Date("2026-11-16T10:00:00Z"); // Taipei 2026-11-16
const form = (over: Partial<{ ratePercent: string; effectiveDate: string; reason: string }> = {}) =>
  validateRateForm({ ratePercent: "12.5", effectiveDate: "2026-12-01", reason: "Client decision", ...over }, NOW);
const codes = (r: ReturnType<typeof form>) => (r.ok ? [] : r.errors.map((e) => `${e.field}:${e.code}`));

describe("validateRateForm", () => {
  it("builds the body from the exact decimal text", () => {
    expect(form()).toEqual({
      ok: true,
      bps: 1250,
      body: { ratePercent: 12.5, effectiveDate: "2026-12-01", reason: "Client decision" },
    });
    const r = form({ ratePercent: "0.07" });
    expect(r.ok && r.body.ratePercent).toBe(0.07);
    expect(r.ok && r.bps).toBe(7);
  });
  it("accepts today (Taipei) and rejects yesterday", () => {
    expect(form({ effectiveDate: "2026-11-16" }).ok).toBe(true);
    expect(codes(form({ effectiveDate: "2026-11-15" }))).toEqual(["effectiveDate:past"]);
  });
  it("uses the Taipei day, not the UTC day, around 16:00Z", () => {
    const base = { ratePercent: "5", reason: "abc" };
    const before = validateRateForm({ ...base, effectiveDate: "2026-11-16" }, new Date("2026-11-16T15:59:00Z"));
    const after = validateRateForm({ ...base, effectiveDate: "2026-11-16" }, new Date("2026-11-16T16:00:00Z"));
    expect(before.ok).toBe(true);
    expect(after.ok).toBe(false);
  });
  it("requires an effective date", () => {
    expect(codes(form({ effectiveDate: "" }))).toEqual(["effectiveDate:required"]);
    expect(codes(form({ effectiveDate: "2026-02-30" }))).toEqual(["effectiveDate:invalid"]);
  });
  it("rejects bad percents", () => {
    for (const bad of ["100.01", "1.234", "-1", "abc", "1e1", "5%"]) {
      expect(codes(form({ ratePercent: bad })), bad).toEqual(["ratePercent:invalid"]);
    }
    expect(codes(form({ ratePercent: " " }))).toEqual(["ratePercent:required"]);
    expect(form({ ratePercent: "0" }).ok).toBe(true);
    expect(form({ ratePercent: "100" }).ok).toBe(true);
  });
  it("validates the reason and collects every error", () => {
    expect(codes(form({ reason: "ab" }))).toEqual(["reason:tooShort"]);
    expect(codes(form({ ratePercent: "", effectiveDate: "", reason: "" }))).toEqual([
      "ratePercent:required",
      "effectiveDate:required",
      "reason:required",
    ]);
  });
});
