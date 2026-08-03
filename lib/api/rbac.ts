import { api } from "./client";

/** Roles shown as matrix columns (includes GUEST — not in general Auth `Role`). */
export type RbacRole =
  | "GUEST"
  | "BUYER"
  | "SELLER"
  | "WAREHOUSE"
  | "CS"
  | "ACCOUNTANT"
  | "ADMIN"
  | "SUPER_ADMIN";

export type PermissionScope = "NONE" | "APPROVE" | "SELF" | "SHOP" | "ALL";

/** Permission codes are BE string enums; keep open for new grants. */
export type RbacPermission = string;

export type RbacMatrixCell = {
  role: RbacRole;
  permission: RbacPermission;
  /** Effective scope (default or override). */
  scope: PermissionScope;
  defaultScope: PermissionScope;
  overridden: boolean;
  description: string;
};

export type RbacMatrixData = {
  roles: RbacRole[];
  permissions: RbacPermission[];
  scopes: PermissionScope[];
  overrideCount: number;
  cells: RbacMatrixCell[];
};

export type RbacOverrideRow = {
  id: string;
  role: RbacRole;
  permission: RbacPermission;
  scope: PermissionScope;
  defaultScope: PermissionScope;
  updatedByUserId: string;
  updatedAt: string;
};

export type RbacOverrideCellInput = {
  role: RbacRole;
  permission: RbacPermission;
  scope?: PermissionScope;
  clear?: boolean;
};

export type PutRbacOverridesBody = {
  cells: RbacOverrideCellInput[];
};

export type PutRbacOverridesResult = {
  upserted: number;
  cleared: number;
  overrideCount: number;
};

export type ResetRbacMatrixResult = {
  overrideCount: number;
};

/** Super Admin cells that must not be set to NONE (BE `RBAC_MATRIX_LOCKOUT`). */
export const RBAC_LOCKOUT_CELLS: ReadonlyArray<{
  role: RbacRole;
  permission: RbacPermission;
}> = [
  { role: "SUPER_ADMIN", permission: "CONFIG_SYS" },
  { role: "SUPER_ADMIN", permission: "ASSIGN_ROLES" },
  { role: "SUPER_ADMIN", permission: "MANAGE_STAFF" },
  { role: "SUPER_ADMIN", permission: "VIEW_USERS" },
];

export function isRbacLockoutCell(role: RbacRole, permission: RbacPermission): boolean {
  return RBAC_LOCKOUT_CELLS.some((c) => c.role === role && c.permission === permission);
}

export function rbacCellKey(role: RbacRole, permission: RbacPermission): string {
  return `${role}:${permission}`;
}

export const adminRbacApi = {
  getMatrix: () => api.get<RbacMatrixData>("/admin/rbac/matrix"),

  listOverrides: () => api.get<RbacOverrideRow[]>("/admin/rbac/matrix/overrides"),

  putOverrides: (body: PutRbacOverridesBody) =>
    api.put<PutRbacOverridesResult>("/admin/rbac/matrix/overrides", body),

  resetMatrix: () => api.post<ResetRbacMatrixResult>("/admin/rbac/matrix/reset", {}),
};
