# FE Guide — Product Reviews (011)

Base: `/api/v1` · Auth: cookie / Bearer for mutating routes.

## Public

| Method | Path | Notes |
|--------|------|-------|
| GET | `/products/:productId/reviews` | Paginated `VISIBLE` only |
| GET | `/products/:productId/reviews/summary` | `{ ratingAvg, reviewCount, breakdown }` |

Listing/PDP cards include `ratingAvg`, `reviewCount`.

## Buyer (verified purchase)

| Method | Path | Body |
|--------|------|------|
| POST | `/products/:productId/reviews` | `{ rating: 1-5, comment?, orderId? }` |
| PATCH | `/products/:productId/reviews/:reviewId` | `{ rating?, comment? }` |
| DELETE | `/products/:productId/reviews/:reviewId` | Soft delete |
| POST | `/products/:productId/reviews/:reviewId/images` | multipart `images` (max 5 total, 5MB) |

Requires `DELIVERED` order containing the product. One review per product per buyer.

## Seller reply

| Method | Path | Body |
|--------|------|------|
| POST | `/products/:productId/reviews/:reviewId/reply` | `{ body }` upsert |
| DELETE | `/products/:productId/reviews/:reviewId/reply` | |

## Admin

| Method | Path |
|--------|------|
| GET | `/admin/reviews?status&productId&shopId` |
| POST | `/admin/reviews/:reviewId/hide` | optional `{ reason }` |
| POST | `/admin/reviews/:reviewId/unhide` | |

## Review item (public)

```ts
{
  id, productId, rating, comment, images: string[],
  createdAt, updatedAt,
  buyer: { id, fullName },
  reply?: { body, sellerId, updatedAt }
}
```

## In-app notifications

- New review → shop owner
- Seller reply → buyer
- Admin hide / unhide → buyer

## Seed

`buyer@example.com` has a VISIBLE review on the delivered-order product (`ORD-SEED-DELIVERED`).
