import { beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.fn();
const get = vi.fn();
vi.mock("./client", () => ({ api: { put: (...a: unknown[]) => put(...a), get: (...a: unknown[]) => get(...a) } }));

import { adminSettingsApi } from "./settings";

beforeEach(() => {
  put.mockReset();
  get.mockReset();
});

describe("adminSettingsApi", () => {
  it("PUT sends the Idempotency-Key header and the body untouched", async () => {
    put.mockResolvedValue({});
    await adminSettingsApi.update("maxTotalSlots", { value: null, reason: "no cap" }, "key-1");
    expect(put).toHaveBeenCalledWith(
      "/admin/settings/maxTotalSlots",
      { value: null, reason: "no cap" },
      { headers: { "Idempotency-Key": "key-1" } },
    );
  });
  it("history passes the limit as a query", async () => {
    get.mockResolvedValue({ items: [] });
    await adminSettingsApi.history("maxTotalSlots", 20);
    expect(get).toHaveBeenCalledWith("/admin/settings/maxTotalSlots/history", { query: { limit: 20 } });
  });
  it("bool and decimal values reach the wire as JSON true/false and a number", async () => {
    put.mockResolvedValue({});
    await adminSettingsApi.update("taxEnabled", { value: true, reason: "go" }, "k2");
    await adminSettingsApi.update("taxRatePercent", { value: 5.25, reason: "go" }, "k3");
    expect(put.mock.calls[0]![1]).toEqual({ value: true, reason: "go" });
    expect(JSON.stringify(put.mock.calls[1]![1])).toBe('{"value":5.25,"reason":"go"}');
  });
});
