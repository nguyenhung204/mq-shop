import { describe, expect, it } from "vitest";
import { createKeyedRunners } from "@/lib/queries/idempotent-run";
import { createSerialQueue } from "@/lib/i18n/region-sync";
import { resolveNotificationRoute } from "@/lib/notifications/routes";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("Idempotency-Key per (case, action)", () => {
  const run = (r: ReturnType<typeof createKeyedRunners>, key: string, body: unknown) => r.forKey(key).run(body, async (_v, k) => k);
  it("a retry of the same action on the same case reuses the key, even after other actions on that case", async () => {
    const r = createKeyedRunners();
    const first = await run(r, "c1:dispute", { note: "never arrived" });
    await run(r, "c1:confirm", {}); // a different action in between
    const retry = await run(r, "c1:dispute", { note: "never arrived" });
    expect(retry).toBe(first);
  });
  it("different actions and different cases never share a key", async () => {
    const r = createKeyedRunners();
    const keys = new Set([await run(r, "c1:dispute", { n: 1 }), await run(r, "c1:confirm", { n: 1 }), await run(r, "c2:dispute", { n: 1 }), await run(r, "c1:markPaid", { n: 1 })]);
    expect(keys.size).toBe(4);
  });
  it("success of one action does not rotate the key of another; a changed body or a success rotates its own", async () => {
    const r = createKeyedRunners();
    const d = await run(r, "c1:dispute", { n: 1 });
    const c = await run(r, "c1:confirm", { n: 1 });
    r.forKey("c1:dispute").onSuccess();
    expect(await run(r, "c1:confirm", { n: 1 })).toBe(c);
    expect(await run(r, "c1:dispute", { n: 1 })).not.toBe(d);
    const e = await run(r, "c1:dispute", { n: 2 });
    expect(await run(r, "c1:dispute", { n: 3 })).not.toBe(e);
  });
  it("the hooks use one runner per case:action", () => {
    const q = readFileSync(path.join(__dirname, "..", "queries", "refund-cases.ts"), "utf8");
    expect(q).toContain("runners.forKey(`${vars.id}:${vars.action}`)");
    expect(q).toContain("runners.forKey(`${vars.id}:override`)");
    // failures are shown through the case error mapper (RMA_NOT_PENDING has its own translated text)
    expect(q).toContain('toast.error(caseErrorText(e, "party"))');
    expect(q).toContain('toast.error(caseErrorText(e, "override"))');
    expect(q).toContain("caseRouteErrorKey(e, route)");
  });
});

describe("region switches run in request order", () => {
  it("a slow switch followed by a fast one: the latest request is committed last", async () => {
    const q = createSerialQueue();
    const events: string[] = [];
    const sw = (id: string, ms: number) =>
      q.run(async () => {
        events.push(`start ${id}`);
        await new Promise((r) => setTimeout(r, ms));
        events.push(`commit ${id}`);
        return id;
      });
    const a = sw("my", 30);
    const b = sw("tw", 1);
    expect(await Promise.all([a, b])).toEqual(["my", "tw"]);
    expect(events).toEqual(["start my", "commit my", "start tw", "commit tw"]);
  });
  it("a failed switch does not block or poison the next one", async () => {
    const q = createSerialQueue();
    const bad = q.run(async () => {
      throw new Error("refused");
    });
    await expect(bad).rejects.toThrow("refused");
    await expect(q.run(async () => "ok")).resolves.toBe("ok");
  });
});

describe("notification route encodes the case id", () => {
  it("a hostile id cannot add path segments or a query", () => {
    const r = resolveNotificationRoute({ type: "REFUND_CASE_DISPUTED", meta: { refundCaseId: "a/../b?x=1" } } as never, { roles: ["ADMIN"] } as never);
    expect(r).toBe("/admin/refund-cases/a%2F..%2Fb%3Fx%3D1");
  });
});

describe("dialog focus", () => {
  it("the case dialog uses the focus hook that restores focus on close", () => {
    const m = readFileSync(path.join(__dirname, "..", "..", "components/refund-cases/CaseActionModal.tsx"), "utf8");
    expect(m).toContain("useDialogFocus(dialogRef)");
    expect(m).toContain("ref={dialogRef}");
    const h = readFileSync(path.join(__dirname, "..", "..", "components/ui/useDialogFocus.ts"), "utf8");
    expect(h).toContain("previous?.focus?.()");
    expect(h).toContain("querySelector");
  });
});
