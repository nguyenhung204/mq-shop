import { describe, expect, it } from "vitest";
import { pickerQueryOptions } from "@/components/admin/dividend/AccountPicker";

describe("pickerQueryOptions", () => {
  it("without search permission the /admin/users query is disabled", () => {
    expect(pickerQueryOptions(false, "").enabled).toBe(false);
    expect(pickerQueryOptions(false, "anna").enabled).toBe(false);
  });
  it("with search permission it is enabled and keyed by the term", () => {
    expect(pickerQueryOptions(true, "anna")).toEqual({ enabled: true, queryKey: ["admin", "users", "dividend-picker", "anna"] });
  });
});
