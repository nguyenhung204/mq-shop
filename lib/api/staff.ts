import { api } from "./client";
import type {
  AuthUser,
  PageMeta,
  Paginated,
  StaffPoolRole,
  StaffRole,
} from "./types";

export type CreateStaffRequest = {
  email: string;
  fullName?: string;
  role: StaffRole;
  shopId: string;
};

export type CreateStaffResponse = {
  user: AuthUser;
  temporaryPassword: string;
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

  lock: (userId: string) => api.post<AuthUser>(`/admin/staff/${userId}/lock`, {}),

  unlock: (userId: string) =>
    api.post<AuthUser>(`/admin/staff/${userId}/unlock`, {}),

  remove: (userId: string) => api.delete<AuthUser>(`/admin/staff/${userId}`),
};
