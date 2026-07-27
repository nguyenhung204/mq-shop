# 010 — Commission Calculation · Frontend Integration Guide

> **Base URL:** `http://localhost:3000/api/v1`  
> **Auth:** Cookie JWT — `credentials: 'include'`  
> **Implement branch:** `feat/012-commission-calculation` (stack trên `feat/011-mlm-wallet`)  
> **Flows:** referral realtime · team differential · loyalty · global funds · admin rank

---

## Decisions (MVP — locked)

| Topic | Decision |
|-------|----------|
| Referral trigger | Đơn `DELIVERED` và **`subtotal >= 2000` USD** → F1 upline (PNG). **Không** bắt buộc `isEnrollmentPackage` |
| Referral receiver | Chỉ **F1** (`buyer.referrerId`) — F2 = 0. Referrer **phải có role `SELLER`** (mở shop); Buyer thuần refer → **0** |
| Referral % | Theo rank **referrer** (rank **0** Seller = 5% như Distributor); cap **10%** từ cấp 6–10 |
| Team bonus | Differential “ăn chênh lệch”; **không** gồm tự mua; cron cuối tháng |
| Loyalty | Tổng mua cá nhân tháng (mọi SKU DELIVERED) ≥ **2000 USD** × 12 tháng → **28000 USD** |
| Global | Quỹ **2% GMV** theo tier rank ≥5 / ≥6 / ≥7 / ≥10; stack; empty → công ty giữ |
| Rank upgrade | **Auto Rank Engine** + admin `PATCH` (`CONFIG_MLM`). Seller→Distributor: 2 F1 có đơn mốc (`MLM_RANK_QUALIFY_ORDER_STATUS`, mặc định `DELIVERED`). Bậc sau: N F1 đang giữ `mlmRank >= required` (chỉ F1) |
| DELIVERED | Commission lỗi **không** rollback status đơn |
| HTTP Idempotency-Key | **Không** trên API FE (`GET /mlm/commissions`, admin rank). Idempotency là **phía BE ledger** (xem dưới). |

---

## Idempotency (010 — FE cần biết)

### API FE gọi

| API | Header `Idempotency-Key`? |
|-----|---------------------------|
| `GET /mlm/commissions` | Không (read) |
| `GET /mlm/rank-progress` | Không (read) |
| `GET /admin/mlm/ranks` | Không (read) |
| `PATCH /admin/mlm/users/:id/rank` | Không — set rank; gọi lại cùng rank = no-op thực tế, khác rank thì đổi lại (có cascade auto-promote upline) |

FE **không** cần gửi `Idempotency-Key` cho module commission.

### BE nội bộ (không phải header FE)

Credit ví qua `commission_ledger.idempotency_key` **unique** — chống double credit khi listener/cron chạy lại:

| Key pattern | Khi nào |
|-------------|---------|
| `REFERRAL:{orderId}` | Order `DELIVERED` với `subtotal >= 2000` |
| `TEAM:{yyyy-mm}:{userId}:{f1BranchId}` | Cron team |
| `LOYALTY:{yyyy-mm}:{userId}` | Cron loyalty |
| `GLOBAL:{yyyy-mm}:{tier}:{userId}` | Cron global fund |

→ FE chỉ cần biết: refresh wallet/commissions sau DELIVERED là đủ; không tự “retry credit”.

---

## Table of Contents

1. [Roles & permissions](#1-roles--permissions)
2. [Rank table (UI copy)](#2-rank-table-ui-copy)
3. [Commission history API](#3-commission-history-api)
3b. [Rank progress API](#3b-rank-progress-api)
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

| Rank | Label | Team % | Referral % | Global tier |
|------|-------|--------|------------|-------------|
| 0 | Seller (pre-Distributor) | — | 5 | — |
| 1 | Distributor | 0 | 5 | — |
| 2 | Regional Distributor | 0 | 5 | — |
| 3 | Agency | 2 | 7 | — |
| 4 | Regional Agency | 4 | 8 | — |
| 5 | Director | 6 | 9 | ≥5 |
| 6 | President | 8 | **10** | ≥6 |
| 7 | Crown | 10 | **10** | ≥7 |
| 8 | Crown 1-Star | 11 | **10** | ≥7 |
| 9 | Crown 2-Star | 12 | **10** | ≥7 |
| 10 | Crown 3-Star | **13** | **10** | ≥10 |

**Auto promote (direct F1 only):** 2 F1 with qualify-status order → rank 1; then 2×≥1 → 2; 2×≥2 → 3; …; 3×≥7 → 8; 3×≥8 → 9; 2×≥9 → 10.

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

## 3b. Rank progress API

### `GET /mlm/rank-progress` · `VIEW_MLM_TREE`

Trả tiến độ bước thăng cấp tiếp theo của **chính user**:

| Field | Note |
|-------|------|
| `mlmRank` / `rankName` | Rank hiện tại |
| `nextRank` / `nextRankName` | Bước kế; `null` nếu đã max (10) |
| `mode` | `qualify_orders` (Seller→Distributor) hoặc `f1_rank` |
| `requiredCount` / `currentCount` | Ngưỡng / số F1 đủ điều kiện |
| `requiredF1Rank` | Chỉ `f1_rank` — đếm F1 có `mlmRank >=` |
| `qualifyOrderStatus` | Mốc đơn (env, mặc định `DELIVERED`) |
| `eligibleAsSeller` | Seller→Distributor cần role `SELLER` |

FE: progress bar `currentCount / requiredCount`; refresh sau đơn F1 đạt mốc / khi nhận notify rank upgrade.

---

## 4. Admin rank

### `GET /admin/mlm/ranks` · `CONFIG_MLM`

Danh sách 10 rank config (seed on boot).

### `PATCH /admin/mlm/users/:userId/rank` · `CONFIG_MLM`

```json
{ "rank": 5 }
```

`rank` hợp lệ **0–10** (0 = Seller). Sau khi set, BE cascade kiểm tra upline auto-promote.

Response:

```json
{
  "userId": "…",
  "email": "…",
  "fullName": "…",
  "mlmRank": 5,
  "rankName": "Director"
}
```

Sai rank → `MLM_RANK_INVALID`.

---

## 5. Khi nào số dư ví đổi

| Trụ | Trigger | Wallet `reason` | FE cần poll? |
|-----|---------|-----------------|--------------|
| Referral | Order → `DELIVERED` + `subtotal >= 2000` + referrer có `SELLER` | `REFERRAL` | Optional refresh wallet/commissions sau khi buyer nhận hàng |
| Auto rank | F1 đạt mốc đơn / F1 đổi rank / admin set rank / shop APPROVED (Seller) / cron hourly reconcile / `POST …/ranks/reconcile` | — (notify rank) | Refresh `GET /mlm/rank-progress` + profile `mlmRank` |
| Team | Cron `0 2 1 * *` UTC (tháng trước) | `TEAM` | Không realtime |
| Loyalty | Cùng cron; đủ 12 tháng ≥ 2000 USD | `LOYALTY` | Không realtime |
| Global | Cùng cron; chia quỹ 2% GMV | `GLOBAL` | Không realtime |

Smoke: bất kỳ đơn DELIVERED `subtotal >= 2000` của buyer có `referrerId` **và** referrer đã là `SELLER`. Field `isEnrollmentPackage` **không** dùng cho referral.

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
| `MLM_RANK_INVALID` | Rank ngoài 0–10 / inactive |
| `COMMISSION_ALREADY_CREDITED` | Race idempotency (hiếm; FE ignore) |

Referral fail phía BE chỉ audit — **không** trả lỗi cho API đổi status order.

---

## 8. Seed / smoke

1. Login `mlm-root@example.com` / `Seed123456!`
2. `GET /mlm/commissions` (có thể trống trước khi có đơn DELIVERED ≥ 2000)
3. SA: `GET /admin/mlm/ranks` · `PATCH /admin/mlm/users/:id/rank`
4. Buyer có `referrerId` (referrer = Seller) checkout đơn `subtotal >= 2000` → ship → `DELIVERED` → referrer có dòng `REFERRAL` + `availableBalance` tăng
5. Seller rank 0: 2 F1 mỗi người ≥1 đơn mốc → Seller lên Distributor; `GET /mlm/rank-progress`

Loyalty / team / global: chạy job tháng (BE cron) — FE chỉ đọc lịch sử + wallet.

### Demo / ops: chạy job tay

```http
GET  /admin/mlm/commissions/monthly-overview?monthsBack=12
POST /admin/mlm/commissions/run-monthly
Permission: CONFIG_MLM (Super Admin)
Body (optional): { "yearMonth": "2026-06" }   // mặc định = tháng UTC trước
```

**Overview** trả từng tháng có đơn `DELIVERED`:

| Field | Ý nghĩa |
|-------|---------|
| `yearMonth` | `yyyy-mm` (UTC) |
| `gmv` | Tổng `subtotal` đơn giao trong tháng |
| `deliveredOrderCount` | Số đơn |
| `globalFund.poolPerTier` | Quỹ 2% GMV (mỗi tier dùng chung mức này, stack) |
| `globalFund.tiers[]` | Từng tier ≥5/≥6/≥7/≥10: `PAID` + `beneficiaries[]`, hoặc `COMPANY_KEPT` / `PENDING` |
| `globalFund.totalPaidToUsers` | Tổng đã trả user (mọi tier + unscoped) |
| `globalFund.totalCompanyKept` | Tổng công ty giữ (tier không có ai đủ rank) |
| `globalFund.unscopedPaid` | Credit GLOBAL không gắn tier (seed demo) |
| `credited.*` | Tổng TEAM/GLOBAL/LOYALTY đã credit |
| `suggestedAction` | `RUN` / `RE_RUN_IDEMPOTENT` / `NO_VOLUME` |

Response run-monthly: `{ yearMonth }` sau khi job xong (đồng bộ). Idempotent theo ledger key — gọi lại cùng tháng không double-credit.

**UI demo TEAM / GLOBAL / LOYALTY**

1. `pnpm seed:demo` (có đơn DELIVERED tháng trước từ USER_CASE).
2. Login Super Admin → **Monthly overview** → chọn tháng `suggestedAction=RUN` (hoặc có `gmv > 0`).
3. **Run monthly commission** với `yearMonth` đó.
4. Login `ucase-b01-me@example.com` / `tuanhungvip12@gmail.com` / `tuanhung12.work@gmail.com` → filter `TEAM` \| `GLOBAL` \| `LOYALTY` + Wallet.

---


---


### Admin ops (CONFIG_MLM)

| Method | Path | Body |
|--------|------|------|
| PATCH | `/admin/mlm/users/:userId/rank` | `{ rank: 0..10 }` |
| POST | `/admin/mlm/ranks/reconcile` | `{ userId?: uuid, limit?: 1..500 }` — wake Rank Engine (self multi-step + upline). Omit `userId` → batch (default limit 100) |
| PATCH | `/admin/mlm/users/:userId/referrer` | `{ referrerId: uuid | null }` — rebuild closure, chặn cycle |
| PATCH | `/admin/mlm/users/:userId/referral-rate` | `{ ratePercent: 0..10 | null }` — override % (cap 10); null = rank default |

Profile field: `referralRateOverride` (percent string hoặc null).

Cron: hourly `MlmRankReconcileJob` batch limit 200 (ACTIVE, `mlmRank < 10`).

Shop approve → emit `user.seller_granted` → reconcile owner (Seller→Distributor nếu đã đủ 2 F1 đơn mốc).

## 8b. In-app notifications & audit (010)

| Event | Ai nhận | Title |
|-------|---------|--------|
| Referral / Team / Global / Loyalty credit | Beneficiary | `* commission/bonus credited` |
| Admin set rank | User | MLM rank updated |
| Auto promote | User | MLM rank upgraded |
| Referral skip (referrer chưa Seller) | Referrer | Referral commission not credited — cần mở shop |

**Audit actions:** `commission.referral|team|global|loyalty.credit`, `commission.referral.skip` (not seller), `admin.mlm.rank.set`, `mlm.rank.auto_promote`, `mlm.rank.reconcile` (+ `.cron`).

Idempotent replay (cùng `idempotencyKey`) **không** gửi notify lần 2.

FE: khi nhận toast commission → refresh `GET /mlm/commissions` + `GET /wallet`.

## 9. FE checklist

### Buyer / Seller

- [ ] Màn “Thưởng / Commissions” filter `type`
- [ ] Sau DELIVERED đơn ≥ 2000: refresh wallet + commissions (hoặc theo toast commission)
- [ ] Listen notifications commission / rank change
- [ ] Hiển thị rank hiện tại từ profile (`mlmRank`, gồm **0 = Seller**)
- [ ] Màn progress: `GET /mlm/rank-progress` (current/required, mode)
- [ ] Copy: referral chỉ khi đã mở shop (`SELLER`); Buyer refer không nhận HH
- [ ] Copy giải thích 4 trụ (referral realtime vs 3 trụ cron)

### Super Admin

- [ ] Bảng rank configs
- [ ] Form set rank user (ops MVP)
- [ ] Nút **Monthly overview** → `GET /admin/mlm/commissions/monthly-overview` rồi **Run monthly** theo `yearMonth`
- [ ] Nút / tool reconcile rank khi user “đủ điều kiện mà chưa lên” (`POST /admin/mlm/ranks/reconcile`)
- [ ] Không nhầm với finance `commissionPercent` trên finance config (default MLM khác bảng rank)

---

Entity / golden cases:  
`specs/010-commission-calculation/entity-reference.md`  
`specs/010-commission-calculation/golden/cases.json`  

Wallet / P2P / withdraw:  
`specs/009-mlm-wallet/contracts/fe-guide-mlm-wallet.md`
