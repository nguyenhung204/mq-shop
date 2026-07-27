# FE Guide — Internal Admin Compliance (008)

Base path: `/api/v1`. Cookie auth (`access_token`).

## 1. Dual-control staff roles

### Platform ADMIN — `/admin/platform-staff`

| Method | Path | Who | Notes |
|--------|------|-----|-------|
| POST | `/admin/platform-staff` | Admin / SA | Body `{ email, fullName?, roles:['ADMIN'] }`. Admin → `PENDING`; SA → `ACTIVE` + temp password |
| GET | `/admin/platform-staff?status=` | Admin / SA | |
| PATCH | `/admin/platform-staff/:userId/roles` | Admin / SA | Admin → PENDING + `pendingRoles`; SA applies + force logout |
| POST | `/admin/platform-staff/:userId/approve` | **SA only** | Apply pending roles, ACTIVE, force logout |
| POST | `/admin/platform-staff/:userId/reject` | **SA only** | Clear pending; never-activated → DELETED |

Escalate: Admin assigning `SUPER_ADMIN` → **403**.

### Shop staff — `/admin/staff`

Same dual-control on create / `PATCH .../roles`. Added:

- `POST /admin/staff/:userId/approve`
- `POST /admin/staff/:userId/reject`

Profile fields: `status`, `roles`, `pendingRoles`.

PENDING accounts cannot login (`ACCOUNT_PENDING`).

## 2. Audit logs — `GET /admin/audit-logs`

Permission: `VIEW_AUDIT_LOG` (ACCOUNTANT / ADMIN / SUPER_ADMIN).

Query: `from`, `to`, `actorId`, `actorEmail`, `ip`, `action`, `outcome`, `resourceType`, pagination.

Response item includes `actor.ip`, `beforeJson`, `afterJson`.

## 3. Backup — `/admin/backups`

Permission: `BACKUP_RESTORE` + role **SUPER_ADMIN**.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/admin/backups` | Header **`Idempotency-Key` required**. Body `{ backupType: 'FULL' }` → **202**. `PARTIAL` → 422. If QUEUED/RUNNING exists → **409** |
| GET | `/admin/backups` | List |
| GET | `/admin/backups/:id` | Poll `status` / `progress` (0→10→40→70→90→100) |
| GET | `/admin/backups/:id/download` | Stream zip when `SUCCESS` (no presigned URL) |

During dump: mutating HTTP methods may return **503** (soft maintenance); GET still works.

## 4. DSAR anonymization

### Buyer

| Method | Path | Notes |
|--------|------|-------|
| POST | `/users/me/dsar` | Optional `{ note }` → `SUBMITTED`. 409 if open request |
| GET | `/users/me/dsar` | Own requests |

### Admin

| Method | Path | Notes |
|--------|------|-------|
| POST | `/admin/dsar` | Proxy create for `targetUserId` |
| GET | `/admin/dsar` | List |
| POST | `/admin/dsar/:id/approve` | SUBMITTED → APPROVED |
| POST | `/admin/dsar/:id/execute` | **SA only**; anonymize PII (name/email/avatar), `status=DELETED`, force logout |
| POST | `/admin/dsar/:id/reject` | → REJECTED |

No phone/address scrub (fields not in schema). No physical `DELETE` of user row.

## Seed accounts

- `pending.admin@example.com` — PENDING platform admin  
- `superadmin@example.com` — approve / backup / DSAR execute  
- Default seed password: see seed output (`Seed123456!` unless overridden)
