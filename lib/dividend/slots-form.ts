import { validateReason, type ReasonError } from "@/lib/admin/reason";
import type { SetSlotsBody, SlotHolding, TransferSlotsBody } from "@/lib/api/dividend";
import { gmt8DateTimeLocalToIso, gmt8DayStartIso } from "@/lib/i18n/gmt8-calendar";
import { currentQuarter, isQuarterLabel } from "./dates";

export const MAX_SLOTS = 1_000_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_RE = /^\d{1,7}$/;

export type SlotsContext = {
  quarter: string;
  /** Lock flag of the selected quarter as reported by the server (UI3: locked = read-only). */
  locked: boolean;
  holdings: SlotHolding[];
  now?: Date;
};

export type SlotsFormError =
  | { field: "quarter"; code: "locked" | "future" | "invalid" }
  | { field: "userId" | "fromUserId" | "toUserId"; code: "required" | "invalid" }
  | { field: "toUserId"; code: "same" | "expiryMismatch" }
  | { field: "slots"; code: "required" | "notInteger" | "tooLow" | "tooHigh" | "unchanged" | "insufficient" }
  | { field: "expiresAt"; code: "invalid" | "withZero" | "beforeQuarter" }
  | { field: "reason"; code: ReasonError };

type Result<B> = { ok: true; body: B } | { ok: false; errors: SlotsFormError[] };

function quarterErrors(ctx: SlotsContext): SlotsFormError[] {
  if (!isQuarterLabel(ctx.quarter)) return [{ field: "quarter", code: "invalid" }];
  if (ctx.quarter > currentQuarter(ctx.now ?? new Date())) return [{ field: "quarter", code: "future" }];
  if (ctx.locked) return [{ field: "quarter", code: "locked" }];
  return [];
}

function idError(field: "userId" | "fromUserId" | "toUserId", v: string): SlotsFormError | null {
  if (v.trim() === "") return { field, code: "required" };
  if (!UUID_RE.test(v.trim())) return { field, code: "invalid" };
  return null;
}

function slotsError(raw: string, min: number): { value: number | null; error: SlotsFormError | null } {
  const text = raw.trim();
  if (text === "") return { value: null, error: { field: "slots", code: "required" } };
  if (!INT_RE.test(text)) return { value: null, error: { field: "slots", code: "notInteger" } };
  const n = Number(text);
  if (n < min) return { value: n, error: { field: "slots", code: "tooLow" } };
  if (n > MAX_SLOTS) return { value: n, error: { field: "slots", code: "tooHigh" } };
  return { value: n, error: null };
}

/** First instant (Asia/Taipei midnight) of a quarter label such as 2026Q4. */
export function quarterStartIso(quarter: string): string {
  const y = quarter.slice(0, 4);
  const startMonth = (Number(quarter.slice(5)) - 1) * 3 + 1;
  return gmt8DayStartIso(`${y}-${String(startMonth).padStart(2, "0")}-01`);
}

export type SetSlotsInput = { userId: string; slots: string; expiresAtLocal: string; reason: string };

/** Mirror of POST /admin/dividend/slots (absolute slots, optional expiry, reason, quarter not locked / not in the future). */
export function validateSetSlots(input: SetSlotsInput, ctx: SlotsContext): Result<SetSlotsBody> {
  const errors: SlotsFormError[] = quarterErrors(ctx);
  const id = idError("userId", input.userId);
  if (id) errors.push(id);
  const s = slotsError(input.slots, 0);
  if (s.error) errors.push(s.error);

  const userId = input.userId.trim().toLowerCase();
  let expiresAt: string | undefined;
  if (input.expiresAtLocal.trim() !== "") {
    const iso = gmt8DateTimeLocalToIso(input.expiresAtLocal.trim());
    if (!iso) errors.push({ field: "expiresAt", code: "invalid" });
    else if (isQuarterLabel(ctx.quarter) && Date.parse(iso) <= Date.parse(quarterStartIso(ctx.quarter))) {
      // Server rule: the expiry must be after the start of the quarter the change applies from.
      // (The server does not refuse an expiry already in the past, so neither do we.)
      errors.push({ field: "expiresAt", code: "beforeQuarter" });
    } else expiresAt = iso;
  }

  if (expiresAt !== undefined && s.value === 0) errors.push({ field: "expiresAt", code: "withZero" });

  if (!id && s.value !== null && !s.error) {
    const held = ctx.holdings.find((h) => h.userId.toLowerCase() === userId);
    const heldExpiry = held?.expiresAt ? Date.parse(held.expiresAt) : null;
    const newExpiry = expiresAt ? Date.parse(expiresAt) : null;
    if ((held?.slots ?? 0) === s.value && (s.value === 0 || heldExpiry === newExpiry)) {
      errors.push({ field: "slots", code: "unchanged" });
    }
  }

  const reason = validateReason(input.reason);
  if (!reason.ok) errors.push({ field: "reason", code: reason.error });

  if (errors.length > 0 || s.value === null || !reason.ok) return { ok: false, errors };
  return {
    ok: true,
    body: {
      userId,
      slots: s.value,
      quarter: ctx.quarter,
      ...(expiresAt ? { expiresAt } : {}),
      reason: reason.value,
    },
  };
}

export type TransferInput = { fromUserId: string; toUserId: string; slots: string; reason: string };

/** Mirror of POST /admin/dividend/slots/transfer (two accounts, slots >= 1, enough slots, the receiver's expiry equals the moved slots' expiry). */
export function validateTransfer(input: TransferInput, ctx: SlotsContext): Result<TransferSlotsBody> {
  const errors: SlotsFormError[] = quarterErrors(ctx);
  const from = idError("fromUserId", input.fromUserId);
  const to = idError("toUserId", input.toUserId);
  if (from) errors.push(from);
  if (to) errors.push(to);
  if (!from && !to && input.fromUserId.trim().toLowerCase() === input.toUserId.trim().toLowerCase()) {
    errors.push({ field: "toUserId", code: "same" });
  }
  const s = slotsError(input.slots, 1);
  if (s.error) errors.push(s.error);

  if (!from && s.value !== null && !s.error) {
    const held = ctx.holdings.find((h) => h.userId.toLowerCase() === input.fromUserId.trim().toLowerCase());
    if ((held?.slots ?? 0) < s.value) errors.push({ field: "slots", code: "insufficient" });
    else if (!to) {
      // One holding has one expiry: the moved slots keep the source's expiry, so a receiver that already holds slots must have the same one.
      const recv = ctx.holdings.find((h) => h.userId.toLowerCase() === input.toUserId.trim().toLowerCase());
      if (recv && recv.slots > 0 && (recv.expiresAt ?? null) !== (held?.expiresAt ?? null)) {
        errors.push({ field: "toUserId", code: "expiryMismatch" });
      }
    }
  }

  const reason = validateReason(input.reason);
  if (!reason.ok) errors.push({ field: "reason", code: reason.error });

  if (errors.length > 0 || s.value === null || !reason.ok) return { ok: false, errors };
  return {
    ok: true,
    body: {
      fromUserId: input.fromUserId.trim().toLowerCase(),
      toUserId: input.toUserId.trim().toLowerCase(),
      slots: s.value,
      quarter: ctx.quarter,
      reason: reason.value,
    },
  };
}
