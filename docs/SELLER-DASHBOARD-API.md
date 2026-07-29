# Seller Dashboard API

## Endpoint

```
GET /api/v1/seller/dashboard
```

**Auth:** Cookie `access_token` (JWT) — requires role `SELLER` (or shop staff with VIEW_ORDER permission).

---

## Query Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sections` | string | No | `summary,lowStock` | Comma-separated sections to include |
| `lowStockThreshold` | number | No | `10` | Variants with `available_stock < threshold` are flagged |

### Available sections

- `summary` — Revenue + order counts for current month
- `lowStock` — List of variants running low on stock

---

## Response

### Full response (all sections)

```json
{
  "message": "Seller dashboard retrieved successfully",
  "data": {
    "summary": {
      "revenueThisMonth": "12500000.00",
      "revenueLastMonth": "10200000.00",
      "revenueGrowthPercent": 22.55,
      "totalOrders": 85,
      "deliveredOrders": 62,
      "cancelledOrders": 5,
      "pendingOrders": 8,
      "processingOrders": 10
    },
    "lowStock": {
      "threshold": 10,
      "items": [
        {
          "variantId": "uuid-1",
          "sku": "SKU-001",
          "productTitle": "Áo thun basic",
          "availableStock": 3,
          "reservedStock": 2,
          "sellingPrice": "250000.00"
        },
        {
          "variantId": "uuid-2",
          "sku": "SKU-045",
          "productTitle": "Quần jean slim",
          "availableStock": 0,
          "reservedStock": 5,
          "sellingPrice": "450000.00"
        }
      ],
      "total": 7
    },
    "generatedAt": "2026-07-29T10:00:00.000Z"
  }
}
```

---

## TypeScript Types (for FE)

```typescript
// --- Request ---
interface SellerDashboardParams {
  sections?: string;       // 'summary' | 'lowStock' | 'summary,lowStock'
  lowStockThreshold?: number;
}

// --- Response ---
interface SellerDashboardResponse {
  message: string;
  data: {
    summary?: DashboardSummary;
    lowStock?: DashboardLowStock;
    generatedAt: string; // ISO 8601
  };
}

interface DashboardSummary {
  revenueThisMonth: string;        // decimal string, e.g. "12500000.00"
  revenueLastMonth: string;        // decimal string
  revenueGrowthPercent: number | null; // null if last month = 0 (no division)
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;         // includes REFUND_APPROVED + REFUNDED
  pendingOrders: number;           // status = PENDING
  processingOrders: number;        // PAID + CONFIRMED + PACKED + SHIPPED
}

interface DashboardLowStock {
  threshold: number;
  items: LowStockItem[];
  total: number;                   // total variants below threshold (items is capped at 20)
}

interface LowStockItem {
  variantId: string;
  sku: string;
  productTitle: string;
  availableStock: number;
  reservedStock: number;
  sellingPrice: string;            // decimal string
}
```

---

## Usage Examples

### Fetch all sections (default)

```typescript
const res = await api.get('/seller/dashboard');
```

### Fetch only summary

```typescript
const res = await api.get('/seller/dashboard', {
  params: { sections: 'summary' }
});
```

### Fetch low stock with custom threshold

```typescript
const res = await api.get('/seller/dashboard', {
  params: { sections: 'lowStock', lowStockThreshold: 5 }
});
```

---

## Error Responses

| Status | Condition |
|--------|-----------|
| `401` | Missing/invalid JWT |
| `403` | User does not have SELLER role or VIEW_ORDER permission |
| `403` | User's shop is not APPROVED or is suspended |

---

## Notes

- `revenueThisMonth` / `revenueLastMonth` are based on **delivered orders** (`status = DELIVERED`) within the calendar month (UTC).
- `revenueGrowthPercent` is `null` when last month revenue is 0 (avoid division by zero). FE should display "N/A" or "—".
- `lowStock.items` is sorted by `availableStock ASC` (most critical first), capped at 20 items. Use `total` to show "and X more..." in UI.
- All monetary values are decimal strings (precision 12, scale 2) in the shop's currency (default USD).
- `generatedAt` is server timestamp — use for "last updated" display.
