import type { RbacPermission } from "./rbac";

/**
 * Business domains for the RBAC matrix UI.
 * System / infra permissions are excluded from the default "business" view.
 */
export type RbacPermissionGroupId =
  | "account"
  | "shop"
  | "product"
  | "inventory"
  | "order"
  | "finance"
  | "mlm"
  | "wallet"
  | "marketing"
  | "review"
  | "staff"
  | "compliance"
  | "system";

export const RBAC_PERMISSION_GROUPS: ReadonlyArray<{
  id: RbacPermissionGroupId;
  permissions: ReadonlyArray<RbacPermission>;
}> = [
  {
    id: "account",
    permissions: [
      "VIEW_PROFILE",
      "EDIT_PROFILE",
      "REGISTER_BUYER",
      "DELETE_ACCOUNT",
      "SET_WALLET_PIN",
    ],
  },
  {
    id: "shop",
    permissions: [
      "UPGRADE_SELLER",
      "APPROVE_SELLER",
      "VIEW_SHOP",
      "EDIT_SHOP",
      "SUSPEND_SHOP",
    ],
  },
  {
    id: "product",
    permissions: [
      "VIEW_PROD_PUB",
      "VIEW_PROD_BKG",
      "CREATE_PRODUCT",
      "EDIT_PRODUCT",
      "DELETE_PRODUCT",
      "APPROVE_PRODUCT",
      "MANAGE_BANNED",
    ],
  },
  {
    id: "inventory",
    permissions: [
      "VIEW_INVENTORY",
      "ADD_INVENTORY",
      "EDIT_INVENTORY",
      "SYNC_INVENTORY",
      "WARN_INVENTORY",
    ],
  },
  {
    id: "order",
    permissions: [
      "VIEW_ORDER",
      "CREATE_ORDER",
      "UPDATE_ORDER",
      "CANCEL_ORDER",
      "DELETE_ORDER",
      "PROCESS_RMA",
    ],
  },
  {
    id: "finance",
    permissions: [
      "VIEW_TRANSACT",
      "PAYOUT_SELLER",
      "CONFIG_FEE",
      "CONFIG_PAYMENT",
      "EXPORT_REPORT",
      "CALC_LAND_COST",
    ],
  },
  {
    id: "mlm",
    permissions: [
      "GET_REF_LINK",
      "VIEW_MLM_TREE",
      "VIEW_MLM_COMSN",
      "CONFIG_MLM",
      "APPROVE_MLM",
      "VIEW_LEADERBD",
    ],
  },
  {
    id: "wallet",
    permissions: [
      "VIEW_WALLET",
      "TRANSFER_P2P",
      "CREATE_PAYOUT",
      "APPROVE_PAYOUT",
      "PROCESS_PAYOUT",
      "ADJUST_POINTS",
    ],
  },
  {
    id: "marketing",
    permissions: [
      "VIEW_MKT_MAT",
      "MANAGE_CONTENT",
      "MANAGE_PROMO",
      "APPROVE_PROMO",
    ],
  },
  {
    id: "review",
    permissions: ["CREATE_REVIEW", "VIEW_REVIEW", "REPLY_REVIEW", "MODERATE_REVIEW"],
  },
  {
    id: "staff",
    permissions: ["VIEW_USERS", "MANAGE_STAFF", "ASSIGN_ROLES", "VIEW_AUDIT_LOG"],
  },
  {
    id: "compliance",
    permissions: ["VIEW_CUST_DATA", "PROCESS_DSAR"],
  },
  {
    id: "system",
    permissions: ["CONFIG_SYS", "BACKUP_RESTORE", "CONFIG_SECURE"],
  },
];

const SYSTEM_PERMISSIONS = new Set<string>(
  RBAC_PERMISSION_GROUPS.find((g) => g.id === "system")?.permissions ?? [],
);

export type RbacGroupFilter = "business" | "all" | RbacPermissionGroupId;

export function isBusinessPermission(permission: RbacPermission): boolean {
  return !SYSTEM_PERMISSIONS.has(permission);
}

export function permissionMatchesGroupFilter(
  permission: RbacPermission,
  filter: RbacGroupFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "business") return isBusinessPermission(permission);
  const group = RBAC_PERMISSION_GROUPS.find((g) => g.id === filter);
  if (!group) return true;
  return group.permissions.includes(permission);
}

export function businessGroupOptions(): RbacPermissionGroupId[] {
  return RBAC_PERMISSION_GROUPS.filter((g) => g.id !== "system").map((g) => g.id);
}
