import { api } from "./client";
import type {
  AuthUser,
  PageMeta,
  Paginated,
  Role,
  StaffPoolRole,
  StaffRole,
} from "./types";

export type CreateStaffRequest = {
  email: string;
  fullName?: string;
  role: StaffRole;
  /** Staff roles are platform-level; only sent for legacy shop-scoped staff. */
  shopId?: string;
};

export type CreateStaffResponse = {
  user: AuthUser;
  /** Present when SA creates ACTIVE; omitted when Admin creates PENDING. */
  temporaryPassword?: string;
};

export type UpdateStaffRolesRequest = {
  roles: StaffRole[];
  /** Required when assigning a BUYER candidate (no shopId yet). */
  shopId?: string;
};

export type ListStaffParams = {
  shopId?: string;
  /** BUYER = candidates; WAREHOUSE|CS|ACCOUNTANT = assigned staff. */
  role?: StaffPoolRole;
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type CreatePlatformStaffRequest = {
  email: string;
  fullName?: string;
  /** Only ADMIN is assignable from this UI (SA escalate blocked by BE). */
  roles: Array<"ADMIN">;
};

export type UpdatePlatformStaffRolesRequest = {
  roles: Array<"ADMIN">;
};

export type ListPlatformStaffParams = {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

type PageEnvelope<T> =
  | T[]
  | { data: T[]; meta?: PageMeta }
  | Paginated<T>;

export const adminStaffApi = {
  list: (query?: ListStaffParams) =>
    api.get<PageEnvelope<AuthUser>>("/admin/staff", {
      query,
      withMeta: true,
    }),

  create: (body: CreateStaffRequest) =>
    api.post<CreateStaffResponse>("/admin/staff", body),

  updateRoles: (userId: string, body: UpdateStaffRolesRequest) =>
    api.patch<AuthUser>(`/admin/staff/${userId}/roles`, body),

  approve: (userId: string) =>
    api.post<AuthUser>(`/admin/staff/${userId}/approve`, {}),

  reject: (userId: string) =>
    api.post<AuthUser>(`/admin/staff/${userId}/reject`, {}),

  lock: (userId: string) => api.post<AuthUser>(`/admin/staff/${userId}/lock`, {}),

  unlock: (userId: string) =>
    api.post<AuthUser>(`/admin/staff/${userId}/unlock`, {}),

  remove: (userId: string) => api.delete<AuthUser>(`/admin/staff/${userId}`),
};

export const adminPlatformStaffApi = {
  list: (query?: ListPlatformStaffParams) =>
    api.get<PageEnvelope<AuthUser>>("/admin/platform-staff", {
      query,
      withMeta: true,
    }),

  create: (body: CreatePlatformStaffRequest) =>
    api.post<CreateStaffResponse>("/admin/platform-staff", body),

  updateRoles: (userId: string, body: UpdatePlatformStaffRolesRequest) =>
    api.patch<AuthUser>(`/admin/platform-staff/${userId}/roles`, body),

  approve: (userId: string) =>
    api.post<AuthUser>(`/admin/platform-staff/${userId}/approve`, {}),

  reject: (userId: string) =>
    api.post<AuthUser>(`/admin/platform-staff/${userId}/reject`, {}),
};

export function hasPendingStaffChange(u: AuthUser): boolean {
  return (
    u.status === "PENDING" ||
    (Array.isArray(u.pendingRoles) && u.pendingRoles.length > 0)
  );
}

export function formatPendingRoles(roles: Role[] | null | undefined): string {
  if (!roles?.length) return "";
  return roles.join(", ");
}
