import { describe, expect, it } from "vitest";
import { getTranslation } from "@/lib/i18n/get-translation";
import { labelOrLegacy } from "./legacy-labels";

const t = (key: string) => getTranslation("en", key);

describe("labelOrLegacy", () => {
  it("returns the known label", () => {
    expect(labelOrLegacy(t, "wallet.reasons", "TEAM")).toBe("Team");
    expect(labelOrLegacy(t, "wallet.commissionTypes", "GLOBAL")).toBe("Global");
  });
  it("falls back to the generic legacy label for retired / unknown values, never a raw key", () => {
    expect(labelOrLegacy(t, "wallet.reasons", "RETIRED_TYPE")).toBe("Other (discontinued reward)");
    expect(labelOrLegacy(t, "wallet.commissionTypes", "RETIRED_TYPE")).toBe("Other (discontinued)");
  });
});
