# E2E factory (support/factory.ts)

Everything is created through the real HTTP API (register + OTP from the backend log, shop apply, approvals, stock, checkout, RMA).
Emails/names are unique per process and run: `uniq(prefix)` = `prefix-<runId>-<pid>-<counter>`. Run `factory` calls from tests only
(it needs the stack from `e2e/scripts/stack.sh`). Sessions: `user.api` is an `Api` with the user's cookies; `uiPageFor(browser, user)` (support/ui.ts)
gives a browser page logged in as that user (English UI).

| Function | Purpose |
|---|---|
| `createUser({prefix?, referrerCode?, fullName?})` -> `TestUser {id,email,password,referralCode,api}` | 2-step registration, BUYER role |
| `relogin(user)` | new JWT (needed after a role change, e.g. becoming SELLER) |
| `referralCodeOf(user)` | referral code (read from users/me) |
| `createSellerWithSku({unitPrice='100000.00', stock=50, referrerCode?, prefix?})` -> `TestSeller {user,shopId,productId,variantId,sku,unitPrice}` | user -> shop apply (PDF) -> SUPER_ADMIN approves -> warehouse -> product+SKU -> admin approves -> stock slip IN approved |
| `setRank(userId, rank)` | `PATCH admin/mlm/users/:id/rank` (rank >= 6 = 10% referral rate) |
| `adjustWallet(userId, "-300.00")` / `walletOf(user)` -> `{available, availableCents(bigint hundredths), raw}` | admin credit/debit of points; read own wallet |
| `placeOrder(buyer, seller, qty=1)` | checkout with `MOCK` payment (order starts PAID; shipping is 5 TWD) |
| `deliverOrder(seller, orderId)` | CONFIRMED -> PACKED -> SHIPPED -> DELIVERED as the seller |
| `getOrder(api, id)`, `openRma(buyer, orderId)`, `getRma(api, id)` (support/ui.ts) | reads / RMA creation |
| `completeRmaAfterApproval(buyer, sellerApi, rmaId)` | return-shipped -> return-received -> accept-return -> refund-proof (PNG) -> refund-sent -> confirm-completed (refund complete => commission clawback) |
| `createCreditedReferralOrder({unitPrice?, quantity?, referrerRank=6})` -> `{referrer, buyer, order, creditedCents}` | referrer seller (rank 6) + referred buyer + delivered order whose REFERRAL commission is already CREDITED to the referrer's wallet |
| `commissionRowsOfOrder(orderId)`, `clawedBackCents(orderId)`, `decimalToCents`, `centsToDecimal` | ground truth (SQL read-only) + integer-cent helpers |
| `support/backend-ctl.ts`: `runEligibility(orderId)`, `runReversalSweep()` | run the hourly cron steps that have no HTTP route (see below) |

```ts
const s = await createCreditedReferralOrder();          // order total 100005, referrer credited 310.00 pts
const rma = await openRma(s.buyer, s.order.id);
await ok(await s.referrer.user.api.post(`rma/${rma.id}/approve`, { refundAmount: "40000.00" }));
await completeRmaAfterApproval(s.buyer, s.referrer.user.api, rma.id);
expect(await clawedBackCents(s.order.id)).toBe((s.creditedCents * 4000000n) / 10000500n);
```

## Numbers (why 100000, not 1000)
Referral commission needs order subtotal >= 2000 TWD (hard-coded) and a rank >= 1 referrer; max rate is 10% (rank 6+).
With the seeded FX 0.031 and default point value 0.99999: 100000 x 10% = 10000 TWD -> round2(10000 x 0.031 / 0.99999) = **310.00 points**,
no setting changed. Clawback per step = floor(C x cumulativeRefundCents / orderTotalCents) in hundredths; order total includes the 5 TWD shipping.

## Where SQL / non-HTTP is used (each has a comment in factory.ts)
- `createCreditedReferralOrder`: `UPDATE orders SET delivered_at/paid_at` back 8 days (7-day hold has no API); then **service call** `runEligibility`
  (helper process booting the backend DI container from `mq_backend/dist`, crons stopped; the hourly job is the only trigger);
  then `UPDATE orders SET delivered_at = now() - 1 day` to re-open the 7-day RMA window (in production a refund normally happens BEFORE the credit,
  because an RMA is only allowed within 7 days and the credit comes after 7 days - this re-open is a test construct).
- `commissionRowsOfOrder`, `clawedBackCents`: read-only SELECT on `commission_ledger`.
- `runReversalSweep`: service call of `retryPendingReversals` (cron `17 * * * *`).

## Environment notes
- `e2e/env/backend.env` now sets `COMMISSION_PAYOUT_HOLD=false` (default `true` keeps commissions PENDING and the wallet untouched). Restart only the
  backend after editing it: `bash e2e/scripts/stack.sh backend > e2e/.run/x.out 2>&1` (new subcommand; keeps DB/Redis).
- `support/otp.ts` regex fixed to the real log line `Dev OTP (register) for <email>: <otp>`.
