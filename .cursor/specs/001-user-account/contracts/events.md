# Domain Events: User Account

**Feature**: `001-user-account`

## Produced

### `user.registered`

| Field | Type | Required |
|-------|------|----------|
| userId | UUID | yes |
| email | string | yes |
| registeredAt | ISO-8601 | yes |

**Consumers**: analytics, welcome email (optional future).

### `user.locked`

| Field | Type | Required |
|-------|------|----------|
| userId | UUID | yes |
| actorId | UUID | yes |
| lockedAt | ISO-8601 | yes |

**Side effects**: session revoke (internal), mail job `account.locked`.

### `user.unlocked`

| Field | Type | Required |
|-------|------|----------|
| userId | UUID | yes |
| actorId | UUID | yes |

### `user.deleted`

| Field | Type | Required |
|-------|------|----------|
| userId | UUID | yes |
| email | string | yes (for notification before purge) |
| actorId | UUID | yes |

### `user.email_changed`

| Field | Type | Required |
|-------|------|----------|
| userId | UUID | yes |
| oldEmail | string | yes |
| newEmail | string | yes |

## Job messages (BullMQ)

### `mail.send`

| Field | Type |
|-------|------|
| template | enum: OTP_REGISTER, OTP_EMAIL_CHANGE, OTP_PASSWORD_RESET, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, ACCOUNT_DELETED |
| to | string |
| variables | object |

**Processor**: `mail.processor.ts` — retry 3× exponential backoff.

## Consumed

None for MVP (001 is foundation feature).
