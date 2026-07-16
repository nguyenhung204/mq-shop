# MQ Shop — Frontend

Next.js storefront for the MQ Shopping multi-vendor platform. Soft-modern UI (preserved black/white/gold palette) wired to Backend `/api/v1`.

## Setup

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_API_HOST=http://localhost:3001 (or your BE host)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Docs

- [docs/FE_GUIDE.md](docs/FE_GUIDE.md) — FE business UI rules
- [docs/API_CATALOG.md](docs/API_CATALOG.md) — API list
- [docs/FE_API_CONTRACTS.md](docs/FE_API_CONTRACTS.md) — payloads
- [docs/plan_mq_shopping.md](docs/plan_mq_shopping.md) — BA plan

## App areas

| Area | Path |
|------|------|
| Storefront | `/`, `/shop`, `/product/[slug]`, `/cart`, `/checkout` |
| Auth | `/my-account`, `/my-account/verify-otp`, `/my-account/lost-password` |
| Account | `/account`, `/orders`, `/rma`, `/wallet` |
| Seller | `/seller/*` |
| Admin | `/admin/*` |
| Super Admin | `/super-admin` |

Catalog still falls back to local mock products when search API is unavailable. Checkout/orders/wallet/seller/admin require a running API + JWT.
