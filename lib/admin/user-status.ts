/** The only values `/admin/users?status=` and `/cs/customers?status=` accept: anything else, an empty value included, is 400. */
export const USER_STATUS_FILTERS = ["ACTIVE", "LOCKED", "PENDING_ACTIVATION"] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

/** The `status` query value for a filter selection: undefined (param omitted) unless it is one of the three. */
export function userStatusParam(selected: string | null | undefined): UserStatusFilter | undefined {
  return USER_STATUS_FILTERS.find((s) => s === selected);
}

/** Lock / unlock are refused (409 ACCOUNT_PENDING_ACTIVATION) for an account nobody has claimed yet. */
export function canLockUnlock(status: string | null | undefined): boolean {
  return status !== "PENDING_ACTIVATION";
}
