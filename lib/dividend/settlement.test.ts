import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/queries/utils";
import {
  armedState,
  dividendErrorKey,
  formatBps,
  formatCentsText,
  formatMoney,
  isValidQuarterCode,
  parseQuarterInput,
  periodKeyLabel,
  quarterCodeLabel,
  runQuarterParam,
} from "./settlement";

describe("quarter code YYYYQ", () => {
  it("valid: 20001..21004 and a last digit 1..4", () => {
    for (const c of [20001, 20004, 20264, 20261, 21001, 21004]) expect(isValidQuarterCode(c), String(c)).toBe(true);
    for (const c of [20000, 20005, 20260, 20265, 21005, 21011, 1999, 202641, 20264.5, Number.NaN]) expect(isValidQuarterCode(c), String(c)).toBe(false);
  });
  it("renders as '2026 Q4'; junk is shown as it came, null as a dash", () => {
    expect(quarterCodeLabel(20264)).toBe("2026 Q4");
    expect(quarterCodeLabel(20001)).toBe("2000 Q1");
    expect(quarterCodeLabel(null)).toBe("—");
    expect(quarterCodeLabel(20265)).toBe("20265");
    expect(periodKeyLabel("2026Q4")).toBe("2026 Q4");
    expect(periodKeyLabel("weird")).toBe("weird");
    expect(periodKeyLabel(null)).toBe("—");
  });
  it("parses the code or 2026Q4 / 2026 Q4 / 2026-q4; nothing else", () => {
    expect(parseQuarterInput("20264")).toBe(20264);
    for (const t of ["2026Q4", "2026 Q4", " 2026q4 ", "2026-Q4"]) expect(parseQuarterInput(t), t).toBe(20264);
    for (const t of ["", "2026", "2026Q5", "2026Q0", "Q4", "202640", "2026Q4x", "-2026Q4", "2026.4"]) expect(parseQuarterInput(t), t).toBeNull();
  });
  it("the run route takes 2026Q4; out of range or last digit 0 is refused", () => {
    expect(runQuarterParam("2026 Q4")).toBe("2026Q4");
    expect(runQuarterParam("20264")).toBe("2026Q4");
    expect(runQuarterParam("21004")).toBe("2100Q4");
    expect(runQuarterParam("21005")).toBeNull();
    expect(runQuarterParam("1999Q4")).toBeNull();
    expect(runQuarterParam("abc")).toBeNull();
  });
});

describe("money from integer cents TEXT (BigInt, no float)", () => {
  it("formats small, zero and negative amounts", () => {
    expect(formatCentsText("0")).toBe("0.00");
    expect(formatCentsText("5")).toBe("0.05");
    expect(formatCentsText("100")).toBe("1.00");
    expect(formatCentsText("123456")).toBe("1,234.56");
    expect(formatCentsText("-123456")).toBe("-1,234.56");
    expect(formatCentsText("007")).toBe("0.07");
  });
  it("stays exact beyond 2^53 (a float would lose the last digits)", () => {
    expect(formatCentsText("9007199254740993")).toBe("90,071,992,547,409.93");
    expect(formatCentsText("123456789012345678901234")).toBe("1,234,567,890,123,456,789,012.34");
    expect(String(Number("9007199254740993"))).not.toBe("9007199254740993"); // sanity: a float cannot hold it
  });
  it("uses the locale's separators", () => {
    expect(formatCentsText("123456", "vi-VN")).toBe("1.234,56");
    expect(formatCentsText("123456", "zh-TW")).toBe("1,234.56");
  });
  it("refuses malformed text instead of showing a wrong number", () => {
    for (const bad of ["12.5", "1e3", "abc", "", "--1", null, undefined]) expect(formatCentsText(bad as never), String(bad)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney({ cents: "2500", amount: "25.00" })).toBe("25.00");
  });
  it("tax in basis points by integer split", () => {
    expect(formatBps(500)).toBe("5.00%");
    expect(formatBps(525)).toBe("5.25%");
    expect(formatBps(5)).toBe("0.05%");
    expect(formatBps(0)).toBe("0.00%");
    expect(formatBps(-1)).toBe("—");
    expect(formatBps(1.5)).toBe("—");
    expect(formatBps(null)).toBe("—");
  });
});

const apiErr = (status: number, code: string, details?: unknown) =>
  new ApiError(status, code, { statusCode: status, message: code, data: { code, ...(details ? { details } : {}) } } as never);

describe("dividendErrorKey (run route and reads)", () => {
  it("maps every documented code, with the details in the text", () => {
    expect(dividendErrorKey(apiErr(409, "DIVIDEND_AUTO_CREDIT_DISABLED"))?.key).toBe("dividendSettlements.errors.disabled");
    expect(dividendErrorKey(apiErr(409, "DIVIDEND_AUTO_CREDIT_FROM_REQUIRED"))?.key).toBe("dividendSettlements.errors.fromRequired");
    expect(dividendErrorKey(apiErr(409, "DIVIDEND_QUARTER_NOT_LOCKED", { quarter: "2026Q4", lockAt: "x" }))).toEqual({
      key: "dividendSettlements.errors.notLocked",
      params: { quarter: "2026 Q4" },
    });
    expect(dividendErrorKey(apiErr(409, "DIVIDEND_QUARTER_BEFORE_START", { quarter: "2026Q2", fromQuarter: "2026Q4" }))).toEqual({
      key: "dividendSettlements.errors.beforeStart",
      params: { quarter: "2026 Q2", fromQuarter: "2026 Q4" },
    });
    expect(dividendErrorKey(apiErr(409, "DIVIDEND_SETTLEMENT_FAILED", { quarter: "2026Q3" }))).toEqual({
      key: "dividendSettlements.errors.failed",
      params: { quarter: "2026 Q3" },
    });
    expect(dividendErrorKey(apiErr(404, "DIVIDEND_SETTLEMENT_NOT_FOUND"))?.key).toBe("dividendSettlements.errors.notFound");
    expect(dividendErrorKey(apiErr(404, "DIVIDEND_CREDIT_NOT_FOUND"))?.key).toBe("dividendSettlements.errors.creditNotFound");
  });
  it("leaves other errors to the generic mapper", () => {
    expect(dividendErrorKey(apiErr(400, "DIVIDEND_INPUT_INVALID"))).toBeNull();
    expect(dividendErrorKey(apiErr(500, "INTERNAL_SERVER_ERROR"))).toBeNull();
    expect(dividendErrorKey(new Error("x"))).toBeNull();
  });
  it("getErrorMessage shows the translated text with the quarter filled in, in all locales, never a code", () => {
    const e = apiErr(409, "DIVIDEND_QUARTER_BEFORE_START", { quarter: "2026Q2", fromQuarter: "2026Q4" });
    const texts = new Set<string>();
    for (const loc of ["en", "vi", "zh-TW"] as const) {
      const m = getErrorMessage(e, "fallback", loc);
      expect(m).toContain("2026 Q2");
      expect(m).toContain("2026 Q4");
      expect(m).not.toMatch(/DIVIDEND_|[{}]/);
      texts.add(m);
    }
    expect(texts.size).toBe(3);
    for (const code of ["DIVIDEND_AUTO_CREDIT_DISABLED", "DIVIDEND_AUTO_CREDIT_FROM_REQUIRED", "DIVIDEND_QUARTER_NOT_LOCKED", "DIVIDEND_SETTLEMENT_FAILED", "DIVIDEND_SETTLEMENT_NOT_FOUND", "DIVIDEND_CREDIT_NOT_FOUND"]) {
      for (const loc of ["en", "vi", "zh-TW"] as const) {
        const m = getErrorMessage(apiErr(409, code, { quarter: "2026Q4" }), "fallback", loc);
        expect(m, `${code} ${loc}`).not.toMatch(/fallback|DIVIDEND_|[{}]/);
      }
    }
  });
});

describe("armedState (from meta.autoCredit)", () => {
  it("armed only when the switch is on AND the first quarter is set", () => {
    expect(armedState({ enabled: true, fromQuarterCode: 20264, armed: true })).toBe("armed");
    expect(armedState({ enabled: true, fromQuarterCode: null, armed: false })).toBe("enabledNoQuarter");
    expect(armedState({ enabled: false, fromQuarterCode: 20264, armed: false })).toBe("off");
    expect(armedState(null)).toBe("unknown");
  });
  it("follows the server's armed flag, not a guess from the other two fields", () => {
    expect(armedState({ enabled: true, fromQuarterCode: 20264, armed: false })).toBe("enabledNoQuarter");
  });
});
