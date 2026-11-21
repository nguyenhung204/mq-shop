import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  BUSINESS_REGION_CODES,
  CATALOG_COUNTRIES,
  GATE_REGIONS,
  GATE_REGION_IDS,
  PRODUCT_COUNTRY_CODES,
  REGION_TO_COUNTRY,
  apiRegionCode,
  countryCodeLabel,
  isValidRegion,
  productCountryOptions,
  regionIdFromApiCode,
} from "./regions";
import { checkoutRegionCode, initialRegion, switchRegion } from "./region-sync";

describe("business regions", () => {
  it("are exactly TW, VN, MY, SG and 'us' is not selectable anywhere", () => {
    expect([...BUSINESS_REGION_CODES].sort()).toEqual(["MY", "SG", "TW", "VN"]);
    expect([...GATE_REGION_IDS].sort()).toEqual(["my", "sg", "tw", "vn"]);
    expect(GATE_REGIONS.map((r) => r.id).sort()).toEqual(["my", "sg", "tw", "vn"]);
    expect(Object.keys(REGION_TO_COUNTRY).sort()).toEqual(["my", "sg", "tw", "vn"]);
    expect(isValidRegion("us")).toBe(false);
    expect(regionIdFromApiCode("US")).toBeNull();
    expect(GATE_REGIONS.some((r) => r.currency === "USD")).toBe(false);
  });
  it("every gate region maps to one of the API codes, in upper case", () => {
    for (const r of GATE_REGIONS) expect((BUSINESS_REGION_CODES as readonly string[]).includes(apiRegionCode(r.id))).toBe(true);
    expect(apiRegionCode("vn")).toBe("VN");
  });
  it("API codes map back in any case; junk does not", () => {
    expect(regionIdFromApiCode("vn")).toBe("vn");
    expect(regionIdFromApiCode(" SG ")).toBe("sg");
    expect(regionIdFromApiCode("")).toBeNull();
    expect(regionIdFromApiCode(null)).toBeNull();
    expect(regionIdFromApiCode("ZZ")).toBeNull();
  });
  it("USD stays a display currency: the catalog still knows US for listed products, the region list does not", () => {
    expect(PRODUCT_COUNTRY_CODES).toContain("US");
    expect(CATALOG_COUNTRIES.map((c) => c.code)).toContain("US");
    expect(productCountryOptions().map((c) => c.code)).toContain("TW");
    expect(countryCodeLabel("US")).toBe("United States");
    expect(countryCodeLabel("tw")).toBe("台灣");
    expect(countryCodeLabel("ZZ")).toBe("ZZ");
  });
});

describe("initialRegion: the account's region is the authority", () => {
  it("server region wins over the browser's saved one", () => {
    expect(initialRegion("VN", "tw")).toBe("vn");
    expect(initialRegion("sg", null)).toBe("sg");
  });
  it("falls back to the saved region when the server has none or an unusable one", () => {
    expect(initialRegion(null, "my")).toBe("my");
    expect(initialRegion(undefined, "my")).toBe("my");
    expect(initialRegion("US", "my")).toBe("my");
    expect(initialRegion("", "tw")).toBe("tw");
  });
  it("a stored 'us' from an earlier build is ignored", () => {
    expect(initialRegion(null, "us")).toBeNull();
    expect(initialRegion("TW", "us")).toBe("tw");
  });
});

describe("switchRegion", () => {
  let commit: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    commit = vi.fn();
  });
  it("signed in: asks the API with the upper-case code, then commits", async () => {
    const order: string[] = [];
    const persist = vi.fn(async () => void order.push("persist"));
    commit.mockImplementation(() => order.push("commit"));
    const r = await switchRegion({ id: "vn", authenticated: true, persist, commit });
    expect(r).toEqual({ ok: true });
    expect(persist).toHaveBeenCalledWith("VN");
    expect(order).toEqual(["persist", "commit"]);
  });
  it("signed in and the API refuses: the old region stays (no commit) and the error is returned", async () => {
    const err = new ApiError(400, "REGION_INVALID");
    const r = await switchRegion({ id: "vn", authenticated: true, persist: () => Promise.reject(err), commit });
    expect(r).toEqual({ ok: false, error: err });
    expect(commit).not.toHaveBeenCalled();
  });
  it("signed out: no API call, local commit only", async () => {
    const persist = vi.fn();
    const r = await switchRegion({ id: "my", authenticated: false, persist, commit });
    expect(r).toEqual({ ok: true });
    expect(persist).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledWith("my");
  });
});

describe("checkoutRegionCode", () => {
  it("is the selected region in upper case, or nothing", () => {
    expect(checkoutRegionCode("sg")).toBe("SG");
    expect(checkoutRegionCode("tw")).toBe("TW");
    expect(checkoutRegionCode(null)).toBeUndefined();
  });
});
