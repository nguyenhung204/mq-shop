import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { createIdempotencyKeyStore } from "./idempotency";
import { createIdempotentRunner } from "@/lib/queries/idempotent-run";

describe("createIdempotencyKeyStore", () => {
  it("same body keeps the key, a changed body rotates it, key order does not matter", () => {
    const s = createIdempotencyKeyStore();
    const k1 = s.keyFor({ a: 1, b: 2 });
    expect(s.keyFor({ b: 2, a: 1 })).toBe(k1);
    const k2 = s.keyFor({ a: 1, b: 3 });
    expect(k2).not.toBe(k1);
    expect(s.keyFor({ a: 1, b: 3 })).toBe(k2);
  });
  it("invalidate gives a new key even for the same body", () => {
    const s = createIdempotencyKeyStore();
    const k1 = s.keyFor({ x: 1 });
    s.invalidate();
    expect(s.keyFor({ x: 1 })).not.toBe(k1);
  });
});

describe("createIdempotentRunner (UI6 lifecycle of a write hook)", () => {
  const keys: string[] = [];
  const send = async (_v: unknown, key: string) => {
    keys.push(key);
    return "ok";
  };
  const fresh = () => {
    keys.length = 0;
    return createIdempotentRunner();
  };
  const mismatch = new ApiError(409, "x", { message: "x", data: { code: "IDEMPOTENCY_KEY_REUSE_MISMATCH" } } as never);

  it("a retry with the same body reuses the key", async () => {
    const r = fresh();
    await r.run({ n: 1 }, send);
    r.onError(new Error("network"));
    await r.run({ n: 1 }, send);
    expect(keys[1]).toBe(keys[0]);
  });
  it("a changed body uses a new key", async () => {
    const r = fresh();
    await r.run({ n: 1 }, send);
    await r.run({ n: 2 }, send);
    expect(keys[1]).not.toBe(keys[0]);
  });
  it("after a success an identical submit is a new operation with a new key", async () => {
    const r = fresh();
    await r.run({ n: 1 }, send);
    r.onSuccess();
    await r.run({ n: 1 }, send);
    expect(keys[1]).not.toBe(keys[0]);
  });
  it("IDEMPOTENCY_KEY_REUSE_MISMATCH rotates the key, other errors do not", async () => {
    const r = fresh();
    await r.run({ n: 1 }, send);
    r.onError(new ApiError(500, "boom"));
    await r.run({ n: 1 }, send);
    expect(keys[1]).toBe(keys[0]);
    r.onError(mismatch);
    await r.run({ n: 1 }, send);
    expect(keys[2]).not.toBe(keys[0]);
  });
});
