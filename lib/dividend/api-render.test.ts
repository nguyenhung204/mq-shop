import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api/client", async (orig) => {
  const real = await orig<typeof import("@/lib/api/client")>();
  return { ...real, api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } };
});

import { CreditDetailView } from "@/components/dividend/CreditDetailView";
import { AutoCreditStateCard, AutoCreditWarning, ItemsTable, RunPanel, RunResult, SettlementFacts, SettlementTable } from "@/components/dividend/SettlementViews";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { dividendCreditsApi, dividendSettlementsApi, type SettlementItem, type SettlementView } from "@/lib/api/dividend-settlements";
import { canRunDividendSettlement } from "@/lib/auth/admin-write";
import type { AuthUser } from "@/lib/api/types";
import { createKeyedRunners } from "@/lib/queries/idempotent-run";

const wrap = (n: React.ReactElement) => renderToStaticMarkup(createElement(LanguageProvider, null, n));

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

const money = (cents: string) => ({ cents, amount: "x" });
const settlement = (over: Partial<SettlementView> = {}): SettlementView => ({
  id: "s1", quarter: "2026Q4", status: "COMPLETED", pool: money("1234567890123456789"), remainder: money("99"), paidTotal: money("1234567890123456690"),
  companyRetained: money("99"), totalSlots: 300, itemCount: 3, counts: { pending: 0, credited: 2, skippedZero: 1, skippedNoWallet: 0 }, taxBps: 525,
  rateIntervals: [], fxRateTwdUsd: 31.5, pointUsdValue: 1, lockAt: "2027-01-02T00:00:00Z", snapshotAt: "2027-01-03T00:00:00Z", reportHash: "h",
  finishedAt: "2027-01-03T00:05:00Z", meta: null, createdAt: "2027-01-03T00:00:00Z", ...over,
});
const item = (over: Partial<SettlementItem> = {}): SettlementItem => ({
  id: "i1", quarter: "2026Q4", userId: "u1", email: "a@b.co", fullName: "Ann", slots: 3, amountTwd: money("12345678901234567890"), points: "398.40",
  status: "CREDITED", walletTxId: "w-1", creditedAt: "2027-01-03T00:01:00Z", meta: null, ...over,
});

describe("settlement API client", () => {
  it("list: withMeta, flattened page, and the armed state from meta.autoCredit", async () => {
    const autoCredit = { enabled: true, fromQuarter: "2026Q4", fromQuarterCode: 20264, armed: true };
    get.mockResolvedValue({ data: [{ id: "s1" }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1, autoCredit } });
    const page = await dividendSettlementsApi.list({ page: 1, pageSize: 20 });
    expect(get).toHaveBeenCalledWith("/admin/dividend/settlements", { query: { page: 1, pageSize: 20 }, withMeta: true });
    expect(page.items.map((i) => i.id)).toEqual(["s1"]);
    expect(page.autoCredit).toEqual(autoCredit);
  });
  it("list without meta.autoCredit gives null (state unknown)", async () => {
    get.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    expect((await dividendSettlementsApi.list()).autoCredit).toBeNull();
  });
  it("detail: settlement and items inside data, meta beside it, status filter and quarter in the path", async () => {
    get.mockResolvedValue({ data: { settlement: { id: "s1" }, items: [{ id: "i1" }] }, meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 } });
    const d = await dividendSettlementsApi.detail("2026Q4", { page: 1, pageSize: 50, status: "CREDITED" });
    expect(get).toHaveBeenCalledWith("/admin/dividend/settlements/2026Q4", { query: { page: 1, pageSize: 50, status: "CREDITED" }, withMeta: true });
    expect(d.settlement.id).toBe("s1");
    expect(d.items).toHaveLength(1);
    expect(d.meta?.total).toBe(1);
  });
  it("run: POST with an Idempotency-Key and no body", async () => {
    post.mockResolvedValue({ outcome: "COMPLETED" });
    await dividendSettlementsApi.run("2026Q4", "k-run");
    expect(post).toHaveBeenCalledWith("/admin/dividend/settlements/2026Q4/run", undefined, { headers: { "Idempotency-Key": "k-run" } });
  });
  it("owner credits: list with meta and a detail by id", async () => {
    get.mockResolvedValue({ data: [{ id: "i1" }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    expect((await dividendCreditsApi.list({ page: 1 })).items[0]).toMatchObject({ id: "i1" });
    expect(get).toHaveBeenLastCalledWith("/dividend/credits", { query: { page: 1 }, withMeta: true });
    get.mockResolvedValue({ id: "i1" });
    await dividendCreditsApi.get("i 1");
    expect(get).toHaveBeenLastCalledWith("/dividend/credits/i%201");
  });
  it("one key lifecycle per quarter run", async () => {
    const r = createKeyedRunners();
    const run = (q: string) => r.forKey(`${q}:run`).run(q, async (_v, k) => k);
    const a = await run("2026Q3");
    expect(await run("2026Q3")).toBe(a);
    expect(await run("2026Q4")).not.toBe(a);
  });
});

describe("run-now is SUPER_ADMIN only", () => {
  it("matrix", () => {
    const can = (...roles: string[]) => canRunDividendSettlement({ roles } as AuthUser);
    expect(can("SUPER_ADMIN")).toBe(true);
    for (const r of ["ADMIN", "ACCOUNTANT", "CS", "SELLER", "BUYER", "WAREHOUSE"]) expect(can(r), r).toBe(false);
    expect(canRunDividendSettlement(null)).toBe(false);
  });
  it("the pages only render the run panel behind canRunDividendSettlement", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["app/admin/dividend/settlements/page.tsx", "app/admin/dividend/settlements/[quarter]/page.tsx"]) {
      const s = readFileSync(`${__dirname}/../../${f}`, "utf8");
      expect(s, f).toContain("const canRun = canRunDividendSettlement(user)");
      expect(s, f).toContain("canRun ?");
      expect(s, f).toContain('roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]}');
    }
  });
});

describe("views", () => {
  it("the warning is prominent, translated and mentions the order of steps", () => {
    const html = wrap(createElement(AutoCreditWarning));
    expect(html).toContain('role="alert"');
    expect(html).toContain("dividendSettlements.warning.title");
    expect(html).toContain("dividendSettlements.warning.order");
    expect(wrap(createElement(AutoCreditWarning, { compact: true }))).not.toContain("warning.order");
  });
  it("the state card shows armed / enabled without quarter / off / unknown", () => {
    const card = (s: Parameters<typeof AutoCreditStateCard>[0]["state"]) => wrap(createElement(AutoCreditStateCard, { state: s }));
    expect(card({ enabled: true, fromQuarter: "2026Q4", fromQuarterCode: 20264, armed: true })).toContain("dividendSettlements.armed.armed");
    expect(card({ enabled: true, fromQuarter: null, fromQuarterCode: null, armed: false })).toContain("dividendSettlements.armed.enabledNoQuarter");
    expect(card({ enabled: false, fromQuarter: null, fromQuarterCode: null, armed: false })).toContain("dividendSettlements.armed.off");
    expect(card(null)).toContain("dividendSettlements.armed.unknown");
    expect(card({ enabled: true, fromQuarter: "2026Q4", fromQuarterCode: 20264, armed: true })).toContain("2026 Q4");
  });
  it("the table and facts show money from bigint cents text exactly, no float rounding", () => {
    const html = wrap(createElement(SettlementTable, { items: [settlement()] }));
    expect(html).toContain("12,345,678,901,234,567.89 TWD");
    expect(html).toContain("2026 Q4");
    expect(html).toContain('href="/admin/dividend/settlements/2026Q4"');
    const facts = wrap(createElement(SettlementFacts, { s: settlement() }));
    expect(facts).toContain("5.25%");
    expect(facts).toContain("31.5");
    expect(facts).toContain("0.99 TWD");
  });
  it("a failed settlement shows its reason; the retained amount is a dash until COMPLETED", () => {
    const html = wrap(createElement(SettlementFacts, { s: settlement({ status: "FAILED", companyRetained: null, meta: { failedReason: "does not balance" } }) }));
    expect(html).toContain("does not balance");
    // the bare test provider echoes keys, and the badge falls back to the raw status: FAILED gets the failure tone
    expect(html).toContain('mq-badge-pink">FAILED');
  });
  it("items: exact amount, points, status, skip reason, wallet transaction", () => {
    const html = wrap(
      createElement(ItemsTable, { items: [item(), item({ id: "i2", status: "SKIPPED_NO_WALLET", walletTxId: null, creditedAt: null, meta: { reason: "PENDING_ACTIVATION" } })] }),
    );
    expect(html).toContain("123,456,789,012,345,678.90 TWD");
    expect(html).toContain("398.40");
    expect(html).toContain('mq-badge-teal">CREDITED');
    expect(html).toContain('mq-badge-muted">SKIPPED_NO_WALLET');
    expect(html).toContain("dividendSettlements.skipReason.PENDING_ACTIVATION");
    expect(html).toContain("w-1");
    expect(html).toContain("a@b.co");
  });
  it("the owner view links each line to its detail and shows no account column", () => {
    const html = wrap(createElement(ItemsTable, { items: [item({ userId: undefined, email: undefined })], owner: true }));
    expect(html).toContain('href="/dividend-credits/i1"');
    expect(html).not.toContain("dividendSettlements.col.account");
  });
  it("owner detail: TWD and points, never someone else's data", () => {
    const html = wrap(createElement(CreditDetailView, { item: item({ userId: undefined, email: undefined, settlementStatus: "COMPLETED" }) }));
    expect(html).toContain("123,456,789,012,345,678.90 TWD");
    expect(html).toContain("398.40");
    expect(html).toContain("dividendCredits.settlement");
  });
  it("run panel: explains that the run is synchronous; the list form asks for a quarter, the detail one does not", () => {
    const list = wrap(createElement(RunPanel, { busy: false, onRun: () => {} }));
    expect(list).toContain("dividendSettlements.run.explain");
    expect(list).toContain('placeholder="2026Q4"');
    const detail = wrap(createElement(RunPanel, { fixedQuarter: "2026Q4", busy: false, onRun: () => {} }));
    expect(detail).not.toContain('placeholder="2026Q4"');
    expect(wrap(createElement(RunPanel, { busy: true, onRun: () => {} }))).toMatch(/disabled/);
  });
  it("run result lines for each outcome", () => {
    const html = wrap(createElement(RunResult, { r: { quarter: "2026Q4", outcome: "PARTIAL", settlementId: "s", snapshotCreated: true, credited: 2, skipped: 1, pending: 3, errors: 1 } }));
    expect(html).toContain("dividendSettlements.run.outcome.PARTIAL");
    expect(html).toContain("dividendSettlements.run.partialHint");
    expect(wrap(createElement(RunResult, { r: { quarter: "2026Q4", outcome: "COMPLETED", settlementId: "s", snapshotCreated: false, credited: 0, skipped: 0, pending: 0, errors: 0 } }))).not.toContain("partialHint");
  });
});
