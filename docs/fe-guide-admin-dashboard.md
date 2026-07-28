# FE Guide — Admin Dashboard (`GET /admin/dashboard`)

> **Base URL:** `http://localhost:3000/api/v1`  
> **Auth:** Cookie JWT — `credentials: 'include'`  
> **Implement branch:** `feat/021-admin-dashboard`  
> **Replaces:** N parallel list calls + `meta.total` for launcher tiles (Phase 1)

---

## 1. Endpoint

| Method | Path | Auth |
|--------|------|------|
| GET | `/admin/dashboard` | Admin platform roles (JWT). No single `@RequirePermissions` on route — **BE omits fields** the actor cannot see. |

### Query

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `sections` | string | `queues,snapshot` | Comma-separated: `queues`, `snapshot`. Unknown values ignored; if all invalid → default both. |

**Phase 1 launcher (tiles only):**

```http
GET /api/v1/admin/dashboard?sections=queues
```

**Overview + KPI row:**

```http
GET /api/v1/admin/dashboard?sections=queues,snapshot
```

---

## 2. Response envelope

Standard app envelope:

```ts
{
  statusCode: 200;
  message: 'Success';
  data: {
    message: 'Admin dashboard retrieved successfully';
    data: {
      queues?: AdminDashboardQueues;
      snapshot?: Partial<AdminDashboardSnapshot>;
      generatedAt: string; // ISO — use for "as of" label / stale refresh
    };
  };
}
```

Unwrap: `response.data.data` (inner `data` is service payload).

---

## 3. TypeScript types (FE)

```ts
type DashboardCountTile = {
  count: number;
  href?: string;
  amountUsd?: string;
};

type AdminDashboardQueues = {
  shopsPending?: DashboardCountTile;
  productsPending?: DashboardCountTile;
  ordersPending?: DashboardCountTile;
  rmaPending?: DashboardCountTile;
  settlementsPendingReconcile?: DashboardCountTile;
  sellerPayoutsPending?: DashboardCountTile;
  walletPayoutsPending?: DashboardCountTile;
  promotionsPending?: DashboardCountTile;
  dsarSubmitted?: DashboardCountTile;
  dsarApprovedAwaitingExecute?: DashboardCountTile;
  staffPending?: DashboardCountTile;
  financeConfigsPending?: DashboardCountTile;
};

type AdminDashboardSnapshot = {
  ordersToday?: number;
  ordersThisWeek?: number;
  gmvDeliveredThisMonthUsd?: string;
  activeShops?: number;
  activeProducts?: number;
  suspendedShops?: number;
};
```

**Rules:**

- Missing key = actor **không có quyền** hoặc section không requested — **không** render tile.
- `count === 0` vẫn render (optional hide zero tiles on FE).
- `amountUsd` là string decimal (`"1234.56"`), USD.
- `href` là gợi ý path admin (relative). FE có thể map riêng nếu router khác.

---

## 4. Queue tiles — ý nghĩa COUNT

| Key | COUNT khi | `amountUsd` | Gợi ý `href` |
|-----|-----------|-------------|--------------|
| `shopsPending` | `shops.status = PENDING` | — | `/admin/shops?status=PENDING` |
| `productsPending` | `products.status = PENDING` | — | `/admin/products?status=PENDING` |
| `ordersPending` | `orders.status IN (PAID, CONFIRMED, PACKED, SHIPPED)` — **inbox cần xử lý**, không phải checkout `PENDING` | — | `/admin/orders` |
| `rmaPending` | `rma_requests.status = PENDING` | — | `/admin/rma?status=PENDING` |
| `settlementsPendingReconcile` | `seller_settlements.status = PENDING_RECONCILE` | SUM amount | `/admin/settlements?status=PENDING_RECONCILE` |
| `sellerPayoutsPending` | `seller_payouts.status = PENDING` | — | `/admin/seller-payouts?status=PENDING` |
| `walletPayoutsPending` | `payout_requests.status = PENDING` | SUM amount | `/admin/wallet/payouts?status=PENDING` |
| `promotionsPending` | `promotions.status = PENDING` | — | `/admin/promotions?status=PENDING` |
| `dsarSubmitted` | `dsar_requests.status = SUBMITTED` | — | `/admin/dsar?status=SUBMITTED` |
| `dsarApprovedAwaitingExecute` | `dsar_requests.status = APPROVED` (chờ SA execute) | — | `/admin/dsar?status=APPROVED` |
| `staffPending` | `users.status = PENDING` + có `pendingRoles` (dual-control) | — | `/admin/staff?status=PENDING` |
| `financeConfigsPending` | `finance_configs.status = PENDING_APPROVAL` | — | `/admin/finance/config?status=PENDING_APPROVAL` |

---

## 5. Snapshot KPIs

| Key | Ý nghĩa | Timezone |
|-----|---------|----------|
| `ordersToday` | Orders created since start of **UTC day** | UTC |
| `ordersThisWeek` | Orders created since **UTC Monday 00:00** | UTC |
| `gmvDeliveredThisMonthUsd` | `SUM(subtotal)` orders `DELIVERED` trong tháng UTC hiện tại | UTC |
| `activeShops` | `APPROVED` + `isSuspended = false` | — |
| `suspendedShops` | `isSuspended = true` | — |
| `activeProducts` | `products.status = ACTIVE` | — |

Snapshot object có thể **thiếu field** (partial) theo permission — không assume đủ 6 keys.

---

## 6. Permission → visible fields (BE enforced)

FE **không** cần duplicate full RBAC matrix để ẩn tile — tin response. Optional: hide launcher group nếu empty.

| Field | Permission rule (BE) |
|-------|-------------------|
| `shopsPending` | `APPROVE_SELLER` ≠ NONE |
| `productsPending` | `APPROVE_PRODUCT` ≠ NONE |
| `ordersPending` | `VIEW_ORDER` scope **ALL** |
| `rmaPending` | `PROCESS_RMA` ≠ NONE |
| `settlementsPendingReconcile` | `VIEW_TRANSACT` scope **ALL** |
| `sellerPayoutsPending` | `PAYOUT_SELLER` ≠ NONE |
| `walletPayoutsPending` | `APPROVE_PAYOUT` ≠ NONE |
| `promotionsPending` | `APPROVE_PROMO` ≠ NONE |
| `dsarSubmitted`, `dsarApprovedAwaitingExecute` | `PROCESS_DSAR` ≠ NONE |
| `staffPending` | `MANAGE_STAFF` **or** `ASSIGN_ROLES` ≠ NONE |
| `financeConfigsPending` | `CONFIG_FEE` ≠ NONE |
| `ordersToday`, `ordersThisWeek` | `VIEW_ORDER` ALL |
| `gmvDeliveredThisMonthUsd` | `VIEW_TRANSACT` ALL **or** `CONFIG_MLM` ≠ NONE |
| `activeShops`, `suspendedShops` | `APPROVE_SELLER` **or** `SUSPEND_SHOP` ≠ NONE |
| `activeProducts` | `APPROVE_PRODUCT` ≠ NONE |

### Ví dụ theo seed role

| Account | Typical tiles |
|---------|----------------|
| `superadmin@example.com` | Hầu hết queues + full snapshot |
| `admin@example.com` | Shops/products/promo/orders/RMA/DSAR/staff; có thể thiếu finance approve-only tiles |
| `accountant@example.com` | Settlements, seller payouts, wallet payouts, finance config pending, GMV; thường **không** shops/products promo |

---

## 7. Example responses

### Super Admin — full

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "message": "Admin dashboard retrieved successfully",
    "data": {
      "queues": {
        "shopsPending": { "count": 12, "href": "/admin/shops?status=PENDING" },
        "productsPending": { "count": 45, "href": "/admin/products?status=PENDING" },
        "ordersPending": { "count": 8, "href": "/admin/orders" },
        "rmaPending": { "count": 3, "href": "/admin/rma?status=PENDING" },
        "settlementsPendingReconcile": {
          "count": 5,
          "amountUsd": "1234.56",
          "href": "/admin/settlements?status=PENDING_RECONCILE"
        },
        "sellerPayoutsPending": { "count": 2, "href": "/admin/seller-payouts?status=PENDING" },
        "walletPayoutsPending": {
          "count": 1,
          "amountUsd": "500.00",
          "href": "/admin/wallet/payouts?status=PENDING"
        },
        "promotionsPending": { "count": 4, "href": "/admin/promotions?status=PENDING" },
        "dsarSubmitted": { "count": 1, "href": "/admin/dsar?status=SUBMITTED" },
        "dsarApprovedAwaitingExecute": { "count": 0, "href": "/admin/dsar?status=APPROVED" },
        "staffPending": { "count": 2, "href": "/admin/staff?status=PENDING" },
        "financeConfigsPending": {
          "count": 1,
          "href": "/admin/finance/config?status=PENDING_APPROVAL"
        }
      },
      "snapshot": {
        "ordersToday": 23,
        "ordersThisWeek": 156,
        "gmvDeliveredThisMonthUsd": "45000.00",
        "activeShops": 120,
        "activeProducts": 890,
        "suspendedShops": 3
      },
      "generatedAt": "2026-07-28T05:43:00.000Z"
    }
  }
}
```

### Admin — shops only (illustrative)

```json
{
  "data": {
    "message": "Admin dashboard retrieved successfully",
    "data": {
      "queues": {
        "shopsPending": { "count": 12, "href": "/admin/shops?status=PENDING" }
      },
      "generatedAt": "2026-07-28T05:43:00.000Z"
    }
  }
}
```

---

## 8. FE implementation checklist

### Data fetching

- [ ] On admin home mount: `GET /admin/dashboard?sections=queues` (Phase 1).
- [ ] Optional KPI strip: add `snapshot` to query.
- [ ] Poll / refetch on window focus or every 60–120s (counts can change).
- [ ] Show `generatedAt` as "Updated …" (local time).

### UI tiles

- [ ] Iterate `Object.entries(queues)` — only keys present.
- [ ] Badge = `count`; subtitle = `amountUsd` when set (`$1,234.56`).
- [ ] Click → `router.push(tile.href ?? fallbackMap[key])`.
- [ ] Hide tile when `count === 0` (product choice).

### Do not

- [ ] Do **not** fire 12 separate list APIs just for totals on launcher (use dashboard).
- [ ] Do **not** assume all queue keys exist for every user.
- [ ] Do **not** treat missing snapshot fields as `0` without BE sending them.

### Related (unchanged)

- List/detail pages still use existing admin APIs (`GET /admin/shops`, etc.).
- User notification badge: `GET /notifications` + `unreadCount` (not admin-specific).
- MLM monthly GMV detail: `GET /admin/mlm/commissions/monthly-overview` (Phase 2, separate permission).

---

## 9. Error handling

| Status | When |
|--------|------|
| 401 | Not logged in |
| 403 | Rare at route level if JWT invalid for admin app |

Empty `queues: {}` is valid (role without any queue permission).

---

## 10. Sample fetch (React)

```ts
async function fetchAdminDashboard(sections = 'queues,snapshot') {
  const res = await fetch(
    `/api/v1/admin/dashboard?sections=${encodeURIComponent(sections)}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(String(res.status));
  const json = await res.json();
  return json.data.data as {
    queues?: AdminDashboardQueues;
    snapshot?: Partial<AdminDashboardSnapshot>;
    generatedAt: string;
  };
}
```

---

## 11. Tile label map (FE i18n suggestion)

| Key | EN label |
|-----|----------|
| `shopsPending` | Shops pending approval |
| `productsPending` | Products pending approval |
| `ordersPending` | Orders needing action |
| `rmaPending` | RMA requests |
| `settlementsPendingReconcile` | Settlements to reconcile |
| `sellerPayoutsPending` | Seller payouts pending |
| `walletPayoutsPending` | Wallet withdrawals pending |
| `promotionsPending` | Promotions pending |
| `dsarSubmitted` | DSAR submitted |
| `dsarApprovedAwaitingExecute` | DSAR approved — execute |
| `staffPending` | Staff pending approval |
| `financeConfigsPending` | Finance config pending |

---

See also: [fe-guide-admin-compliance.md](./fe-guide-admin-compliance.md) (DSAR, backup, staff dual-control).
