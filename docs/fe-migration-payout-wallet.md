# FE Migration Guide — Chi trả Seller qua Ví Nội Bộ

Tài liệu ghi lại các thay đổi FE tương ứng với việc BE chuyển luồng chi trả từ **bank transfer** sang **credit trực tiếp vào ví nội bộ** của shop owner.

---

## Tổng quan thay đổi

### Trước

```
Admin approve payout → BE chuyển khoản ngân hàng (bank transfer)
                       → seller nhận tiền qua tài khoản ngân hàng
```

### Sau

```
Admin approve payout → BE credit thẳng vào ví nội bộ của shop owner
                       → seller thấy số dư ví tăng
```

Không có breaking change trên API shape. Tất cả endpoint payout (POST, GET, approve PATCH, reject PATCH) giữ nguyên URL, method, và response schema.

---

## Các thay đổi FE đã thực hiện

### 1. Xóa API `updateBankInfo`

**File:** `lib/api/index.ts`

Hàm `shopApi.updateBankInfo()` (gọi `PATCH /shops/me/bank-info`) đã bị xóa. Endpoint này không còn tồn tại trên BE.

### 2. Ẩn form Bank Info trong shop settings

**File:** `components/seller/ShopDashboard.tsx`

Block render `<ShopBankInfoForm>` trong section `details` đã được xóa. Seller không còn thấy form cập nhật thông tin ngân hàng trong shop settings.

Component `components/seller/ShopBankInfoForm.tsx` giữ nguyên trong codebase nhưng không được render ở đâu nữa — có thể xóa hẳn ở cleanup sau.

### 3. Cập nhật copy notification `SELLER_PAYOUT_COMPLETED`

**File:** `lib/i18n/notifications/copy.ts`

| Locale | Trước | Sau |
|--------|-------|-----|
| `en` | `Your payout of {amount} has been transferred to your bank account.` | `Your payout of {amount} has been credited to your wallet.` |
| `vi` | `Khoản chi trả {amount} đã được chuyển vào tài khoản ngân hàng của bạn.` | `Khoản chi trả {amount} đã được ghi có vào ví của bạn.` |

### 4. Xóa `SHOP_BANK_INFO_REMINDER` khỏi notification pipeline

**Files:** `components/providers/NotificationProvider.tsx`, `lib/notifications/localize.ts`, `lib/notifications/routes.ts`

Notification type này không còn được BE emit. Đã xóa:

- Entry trong `NOTIFY_INVALIDATION_MAP` (NotificationProvider) — không còn trigger invalidate `sellerKeys.all` khi nhận type này
- Entry trong `STATUS_DOMAIN_BY_TYPE` (localize.ts) — domain mapping `"shop"` đã bỏ
- `case "SHOP_BANK_INFO_REMINDER"` trong `resolveNotificationRoute()` (routes.ts) — không còn navigate về `/seller/shop`

> Note: `SHOP_BANK_INFO_SETUP` vẫn còn vì đây là type khác (thông báo khi shop được approve lần đầu), không bị ảnh hưởng.

### 5. Ẩn `gatewayRef` trên UI

**Files:**
- `components/wallet/walletPayoutUi.tsx` — `WalletPayoutDetailFields`
- `app/admin/payouts/page.tsx` — danh sách payout admin
- `app/admin/payouts/[id]/page.tsx` — chi tiết payout admin
- `app/admin/wallet/payouts/page.tsx` — danh sách wallet payout admin

Field `gatewayRef` trong payout response sẽ luôn là `null` từ nay (không còn bank transaction reference). Các block render giá trị này (label "Mã giao dịch ngân hàng" / `gatewayRef`) đã được xóa khỏi UI.

---

## Không thay đổi

- URL, method, request/response shape của tất cả payout endpoint
- Logic approve/reject payout trên admin UI
- Toàn bộ wallet UI phía seller (số dư, lịch sử giao dịch)
- `SHOP_BANK_INFO_SETUP` notification (vẫn còn)
- `bankInfo` field trên payout response trong `walletPayoutUi.tsx` — đã ẩn sẵn từ trước bằng conditional render, không thay đổi
