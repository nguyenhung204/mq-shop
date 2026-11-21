import { validateReason, type ReasonError } from "@/lib/admin/reason";
import type { AccountTree, InviteStatus, SubAccountItem, SubAccountListMeta, TreeItem } from "@/lib/api/sub-accounts";
import { BUSINESS_REGION_CODES } from "@/lib/i18n/regions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX = 320;
export const NAME_MAX = 200;
/** Pending sub-accounts and invites expire after this many days (the API does not return the date). */
export const PENDING_DAYS = 7;
export const DEFAULT_CAP = 100;

export type CreateFormInput = { email: string; fullName: string; regionCode: string; reason?: string };
export type CreateFormError =
  | { field: "email"; code: "required" | "invalid" | "tooLong" }
  | { field: "fullName"; code: "tooLong" | "invalid" }
  | { field: "regionCode"; code: "invalid" }
  | { field: "reason"; code: ReasonError };

export type CreateBody = { email: string; fullName?: string; regionCode?: string };

/**
 * Create form (owner and admin share it; `admin` adds the mandatory reason 3..500). Empty optional fields are
 * not sent (the body is strict: unknown fields are 400). The e-mail is trimmed; the region is upper case.
 */
export function validateCreate(
  input: CreateFormInput,
  admin: boolean,
): { ok: true; body: CreateBody & { reason?: string } } | { ok: false; errors: CreateFormError[] } {
  const errors: CreateFormError[] = [];
  const email = input.email.trim();
  if (email === "") errors.push({ field: "email", code: "required" });
  else if (email.length > EMAIL_MAX) errors.push({ field: "email", code: "tooLong" });
  else if (!EMAIL_RE.test(email)) errors.push({ field: "email", code: "invalid" });
  const name = input.fullName.trim();
  if (name.includes("\u0000")) errors.push({ field: "fullName", code: "invalid" });
  else if (name.length > NAME_MAX) errors.push({ field: "fullName", code: "tooLong" });
  const region = input.regionCode.trim().toUpperCase();
  if (region !== "" && !(BUSINESS_REGION_CODES as readonly string[]).includes(region)) errors.push({ field: "regionCode", code: "invalid" });
  let reason: string | undefined;
  if (admin) {
    const r = validateReason(input.reason ?? "");
    if (!r.ok) errors.push({ field: "reason", code: r.error });
    else reason = r.value;
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: { email, ...(name ? { fullName: name } : {}), ...(region ? { regionCode: region } : {}), ...(reason !== undefined ? { reason } : {}) },
  };
}

/** Register link of an invite. The token is a secret: it is only ever used to build this link. */
export function buildInviteLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/register?invite=${encodeURIComponent(token)}`;
}

/** `inviteToken` of the register body from the page query (`?invite=`): trimmed, up to 64 characters (DTO limit), else none. */
export function inviteTokenFromQuery(raw: string | null | undefined): string | undefined {
  const v = (raw ?? "").trim();
  return v !== "" && v.length <= 64 ? v : undefined;
}

/**
 * The invite token kept in memory across renders: the token read from the URL replaces what was kept, and a
 * render where the URL no longer has it (it was removed from the address bar) keeps the earlier one.
 */
export function keepInviteToken(kept: string | undefined, inUrl: string | undefined): { kept: string | undefined; token: string | undefined } {
  const next = inUrl ?? kept;
  return { kept: next, token: next };
}

/** An invite and a referral code cannot be combined (400 REFERRER_INVALID): the invite wins. */
export function registerReferral(invite: string | undefined, referrerCode: string | undefined): { inviteToken?: string; referrerCode?: string } {
  if (invite) return { inviteToken: invite };
  return referrerCode ? { referrerCode } : {};
}

export const isPendingAccount = (status: string | null | undefined) => status === "PENDING_ACTIVATION";

/** "n of cap" counters of the owner list. Falls back to the default cap when the API did not send one. */
export function counters(meta: SubAccountListMeta | undefined): { used: number; cap: number; pending: number } {
  return { used: meta?.subAccountCount ?? 0, cap: meta?.cap ?? DEFAULT_CAP, pending: meta?.pendingCount ?? 0 };
}

export const atCap = (c: { used: number; cap: number }) => c.used >= c.cap;

/** Invites that can still be revoked. */
export const canRevoke = (status: InviteStatus) => status === "PENDING";

/** The token the creation call returned, or why there is none (replay of the same Idempotency-Key: never recoverable). */
export function inviteReveal(created: { token: string | null } | undefined): { kind: "token"; token: string } | { kind: "replayed" } | { kind: "none" } {
  if (!created) return { kind: "none" };
  return created.token ? { kind: "token", token: created.token } : { kind: "replayed" };
}

export type DeclineErrors = "email" | "code";
/** Decline form: a valid e-mail and the 6-digit code from the mail. */
export function validateDecline(input: { email: string; code: string }): { ok: true; body: { email: string; code: string } } | { ok: false; errors: DeclineErrors[] } {
  const errors: DeclineErrors[] = [];
  const email = input.email.trim();
  const code = input.code.trim();
  if (!EMAIL_RE.test(email) || email.length > EMAIL_MAX) errors.push("email");
  if (!/^[0-9]{6}$/.test(code)) errors.push("code");
  return errors.length > 0 ? { ok: false, errors } : { ok: true, body: { email, code } };
}

export type TreeRow = TreeItem & { indent: number };
/** Tree rows ordered parent-first (depth, then creation); the indent is relative to the shallowest row shown. */
export function treeRows(tree: Pick<AccountTree, "items">): TreeRow[] {
  const base = tree.items.reduce((m, i) => Math.min(m, i.depth), Number.POSITIVE_INFINITY);
  return [...tree.items]
    .sort((a, b) => a.depth - b.depth || a.createdAt.localeCompare(b.createdAt))
    .map((i) => ({ ...i, indent: Math.max(0, i.depth - base) }));
}

export type { SubAccountItem };

/** Bounds of the admin tree read (maxDepth 1..50, limit 1..1000). */
export const TREE_DEFAULT_DEPTH = 20;
export const TREE_DEFAULT_LIMIT = 200;
