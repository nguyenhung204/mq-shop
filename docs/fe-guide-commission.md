# 010 — Commission Calculation · Frontend Integration Guide

> **Base URL:** `http://localhost:3000/api/v1`  
> **Auth:** Cookie JWT — `credentials: 'include'`  
> **Implement branch:** `feat/012-commission-calculation` (stack trên `feat/011-mlm-wallet`)  
> **Flows:** referral realtime · team differential · loyalty · global funds · admin rank

---

## Decisions (MVP — locked)

| Topic | Decision |
|-------|----------|
| Referral trigger | Chỉ đơn `DELIVERED` có SKU `isEnrollmentPackage` (vd. `PKG-GOLD`) |
| Referral receiver | Chỉ **F1** (`buyer.referrerId`) — F2 = 0 |
| Referral % | Theo rank **referrer**; cap **10%** từ cấp 6–10 |
| Team bonus | Differential “ăn chênh lệch”; **không** gồm tự mua; cron cuối tháng |
| Loyalty | Tổng mua cá nhân tháng (mọi SKU DELIVERED) ≥ **2000 USD** × 12 tháng → **28000 USD** |
| Global | Quỹ **2% GMV** theo tier rank ≥5 / ≥6 / ≥7 / ≥10; stack; empty → công ty giữ |
| Rank upgrade | **Admin set tay** (`CONFIG_MLM`) — chưa auto-rank |
| DELIVERED | Commission lỗi **không** rollback status đơn |

---

## Table of Contents

1. [Roles & permissions](#1-roles--permissions)
2. [Rank table (UI copy)](#2-rank-table-ui-copy)
3. [Commission history API](#3-commission-history-api)
4. [Admin rank](#4-admin-rank)
5. [Khi nào số dư ví đổi](#5-khi-nào-số-dư-ví-đổi)
6. [TypeScript types](#6-typescript-types)
7. [Error codes](#7-error-codes)
8. [Seed / smoke](#8-seed--smoke)
9. [FE checklist](#9-fe-checklist)

---

## 1. Roles & permissions

| Permission | Buyer/Seller | Accountant | Admin | Super Admin |
|------------|--------------|------------|-------|-------------|
| `VIEW_MLM_COMSN` | SELF | ALL* | ALL* | ALL |
| `CONFIG_MLM` | — | APPROVE* | — | ALL |

\* API list commissions hiện **SELF** (`GET /mlm/commissions` = ví/commission của chính user). Admin rank: SA (+ matrix Accountant APPROVE — dùng `PATCH` khi có quyền).

### UI gate

| Màn | Role |
|-----|------|
| Lịch sử thưởng / filter type | Buyer / Seller |
| Set rank user | Super Admin (`CONFIG_MLM`) |
| Xem bảng % rank | Super Admin `GET /admin/mlm/ranks` |

---

## 2. Rank table (UI copy)

| Rank | Nhãn gợi ý | Team % | Referral % | Global tier |
|------|------------|--------|------------|-------------|
| 1 | Phân phối | 0 | 5 | — |
| 2 | (gap) | 0 | 5 | — |
| 3 | Đại lý | 2 | 7 | — |
| 4 | (gap) | 4 | 8 | — |
| 5 | Giám đốc | 6 | 9 | ≥5 |
| 6 | Chủ tịch | 8 | **10** | ≥6 |
| 7 | Crown | 10 | **10** | ≥7 |
| 8 | Crown 1★ | 11 | **10** | ≥7 |
| 9 | Crown 2★ | 12 | **10** | ≥7 |
| 10 | Crown 3★ | **13** | **10** | ≥10 |

- **Referral** cap 10% từ rank 6+ (không lấy team %).
- **Team** differential có thể tới 13% ở rank 10.

`GET /admin/mlm/ranks` trả source-of-truth từ DB (`teamPercent` / `referralPercent` dạng `"5.0000"` = 5%).

---

## 3. Commission history API

### `GET /mlm/commissions` · `VIEW_MLM_COMSN`

Query: `page`, `pageSize`, `type?` = `REFERRAL|TEAM|GLOBAL|LOYALTY`

Item (enrich):

| Field | Note |
|-------|------|
| `type` | Loại thưởng |
| `beneficiaryUserId` | Người nhận |
| `beneficiaryRank` | Snapshot rank lúc tính |
| `beneficiaryName` / `beneficiaryEmail` | Enrich từ profile |
| `payoutAmount` | Số credit ví |
| `baseAmount` / `ratePercent` | Cơ sở + % |
| `status` | `PENDING` · `CREDITED` · `VOID` |
| `periodYearMonth` | `2026-07` cho team/global/loyalty; null nếu referral |
| `sourceOrderId` | Referral |
| `idempotencyKey` | Debug / idempotent |
| `creditedAt` | Khi đã vào ví |

UI: tab theo `type`; badge status; link order nếu có `sourceOrderId`.

---

## 4. Admin rank

### `GET /admin/mlm/ranks` · `CONFIG_MLM`

Danh sách 10 rank config (seed on boot).

### `PATCH /admin/mlm/users/:userId/rank` · `CONFIG_MLM`

```json
{ "rank": 5 }
```

Response:

```json
{
  "userId": "…",
  "email": "…",
  "fullName": "…",
  "mlmRank": 5,
  "rankName": "Giám đốc"
}
```

Sai rank → `MLM_RANK_INVALID`.

---

## 5. Khi nào số dư ví đổi

| Trụ | Trigger | Wallet `reason` | FE cần poll? |
|-----|---------|-----------------|--------------|
| Referral | Order → `DELIVERED` + enrollment SKU | `REFERRAL` | Optional refresh wallet/commissions sau khi buyer nhận hàng |
| Team | Cron `0 2 1 * *` UTC (tháng trước) | `TEAM` | Không realtime |
| Loyalty | Cùng cron; đủ 12 tháng ≥ 2000 USD | `LOYALTY` | Không realtime |
| Global | Cùng cron; chia quỹ 2% GMV | `GLOBAL` | Không realtime |

Enrollment product seed: **Gold Enrollment Package** / SKU `PKG-GOLD` (`isEnrollmentPackage: true`).

---

## 6. TypeScript types

```ts
type CommissionType = "REFERRAL" | "TEAM" | "GLOBAL" | "LOYALTY";

type CommissionLedgerStatus = "PENDING" | "CREDITED" | "VOID";

type CommissionRow = {
  id: string;
  type: CommissionType;
  beneficiaryUserId: string;
  beneficiaryRank: number;
  beneficiaryName?: string | null;
  beneficiaryEmail?: string | null;
  sourceOrderId: string | null;
  periodYearMonth: string | null;
  baseAmount: string;
  ratePercent: string;
  payoutAmount: string;
  status: CommissionLedgerStatus;
  creditedAt: string | null;
  createdAt: string;
};

type MlmRankConfig = {
  rank: number;
  name: string;
  teamPercent: string;
  referralPercent: string;
  globalFundTier: number | null;
  isActive: boolean;
};
```

---

## 7. Error codes

| Code | Khi nào |
|------|---------|
| `MLM_RANK_INVALID` | Rank ngoài 1–10 / inactive |
| `COMMISSION_ALREADY_CREDITED` | Race idempotency (hiếm; FE ignore) |

Referral fail phía BE chỉ audit — **không** trả lỗi cho API đổi status order.

---

## 8. Seed / smoke

1. Login `mlm-root@example.com` / `Seed123456!`
2. `GET /mlm/commissions` (có thể trống trước khi có đơn enrollment DELIVERED)
3. SA: `GET /admin/mlm/ranks` · `PATCH /admin/mlm/users/:id/rank`
4. Checkout `PKG-GOLD` với buyer có `referrerId` → ship → `DELIVERED` → referrer có dòng `REFERRAL` + `availableBalance` tăng

Loyalty / team / global: chạy job tháng (BE cron) — FE chỉ đọc lịch sử + wallet.

---

## 9. FE checklist

### Buyer / Seller

- [ ] Màn “Thưởng / Commissions” filter `type`
- [ ] Sau DELIVERED enrollment: refresh wallet + commissions
- [ ] Hiển thị rank hiện tại từ profile (`mlmRank`)
- [ ] Copy giải thích 4 trụ (referral realtime vs 3 trụ cron)

### Super Admin

- [ ] Bảng rank configs
- [ ] Form set rank user (ops MVP)
- [ ] Không nhầm với finance `commissionPercent` trên finance config (default MLM khác bảng rank)

---

Entity / golden cases:  
`specs/010-commission-calculation/entity-reference.md`  
`specs/010-commission-calculation/golden/cases.json`  

Wallet / P2P / withdraw:  
`specs/009-mlm-wallet/contracts/fe-guide-mlm-wallet.md`
