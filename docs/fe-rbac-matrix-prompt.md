# FE: Admin Runtime RBAC Permission Matrix (Super Admin)

## Context

Backend NestJS ships a **runtime** permission matrix API (DB overrides merged with compile-time defaults). This FE screen is **Super Admin only** (`SUPER_ADMIN` + `CONFIG_SYS`).

Auth: cookie session (same as other admin pages). Regular Admin → 403 / redirect.

## Scope legend

| Scope | Meaning |
|--------|---------|
| `NONE` | No access |
| `APPROVE` | Approve/review only |
| `SELF` | Own data only |
| `SHOP` | Own shop only |
| `ALL` | Full |

Roles (columns): `GUEST` | `BUYER` | `SELLER` | `WAREHOUSE` | `CS` | `ACCOUNTANT` | `ADMIN` | `SUPER_ADMIN`

## APIs

Base path follows FE env (`NEXT_PUBLIC_API_HOST` + `/api/v1`).

### 1. `GET /admin/rbac/matrix`

```ts
data: {
  roles: UserRole[];
  permissions: Permission[];
  scopes: PermissionScope[];
  overrideCount: number;
  cells: Array<{
    role: UserRole;
    permission: Permission;
    scope: PermissionScope;
    defaultScope: PermissionScope;
    overridden: boolean;
    description: string;
  }>;
}
```

### 2. `GET /admin/rbac/matrix/overrides`

Active override list (`id`, `role`, `permission`, `scope`, `defaultScope`, `updatedByUserId`, `updatedAt`).

### 3. `PUT /admin/rbac/matrix/overrides`

Batch save (1–500 cells). Diff only:

- change scope → `{ role, permission, scope }`
- revert to default → `{ role, permission, clear: true }`

### 4. `POST /admin/rbac/matrix/reset`

Clear all overrides → compile-time defaults.

## Lockout (do not allow `NONE`)

- `SUPER_ADMIN` × `CONFIG_SYS`
- `SUPER_ADMIN` × `ASSIGN_ROLES`
- `SUPER_ADMIN` × `MANAGE_STAFF`
- `SUPER_ADMIN` × `VIEW_USERS`

Error codes: `FORBIDDEN`, `RBAC_MATRIX_INVALID`, `RBAC_MATRIX_LOCKOUT`.

## FE routes

- Page: `/admin/rbac`
- Nav: System group (Super Admin)
- Hub: `/admin/system`

## Implementation map

| Piece | Path |
|--------|------|
| API | `lib/api/rbac.ts` |
| Queries | `lib/queries/rbac.ts` |
| UI | `components/admin/RbacPermissionMatrix.tsx` |
| Page | `app/admin/rbac/page.tsx` |

## Acceptance

- [x] Non–Super-Admin cannot open the screen (AuthGuard + nav `sa`)
- [x] Matrix shows effective scope + overridden highlight
- [x] Multi-cell edits → one PUT; clear uses `clear: true`
- [x] Lockout cells block `NONE`; BE `RBAC_MATRIX_LOCKOUT` toasted
- [x] Reset all has confirm + reload
- [x] Sticky permission column + horizontal scroll
