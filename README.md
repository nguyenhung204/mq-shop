# MQ Shop

Frontend cho nền tảng thương mại điện tử **MQ Shopping** — storefront, seller dashboard, admin panel. Giao diện soft-modern với palette black/white/gold.

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + TailwindCSS 4 |
| Server State | TanStack React Query v5 |
| Client State | Zustand v5 (persist localStorage) |
| Forms | React Hook Form + Zod v4 |
| Charts | Recharts |
| Real-time | SSE + socket.io-client |
| Icons | Lucide React |
| Toasts | Sonner |

## Khởi chạy nhanh

```bash
# 1. Install
npm install

# 2. Tạo env
cp .env.example .env.local
# Set NEXT_PUBLIC_API_HOST=http://localhost:3000

# 3. Chạy dev
npm run dev
# → http://localhost:3000
```

**Yêu cầu**: Backend (mq_backend) phải đang chạy tại `NEXT_PUBLIC_API_HOST`.

## Khu vực ứng dụng

| Khu vực | Routes | Vai trò |
|---------|--------|---------|
| Storefront | `/`, `/shop`, `/product/:slug` | Guest / Buyer |
| Auth | `/my-account`, `/my-account/register`, `/my-account/verify-otp` | Guest |
| Cart & Checkout | `/cart`, `/checkout` | Buyer |
| Buyer Account | `/account`, `/orders`, `/wallet`, `/mlm/network`, `/rma` | Buyer |
| Seller Dashboard | `/seller/*` (13 pages) | Seller |
| Admin Panel | `/admin/*` (30+ pages) | Admin / Super Admin |
| Super Admin | `/super-admin` | Super Admin |

## Scripts

| Script | Mô tả |
|--------|--------|
| `npm run dev` | Dev server (hot reload) |
| `npm run build` | Production build (standalone) |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |

## Cấu trúc thư mục

```
mq-shop/
├── app/              # Next.js App Router (pages & layouts)
│   ├── admin/        # 30+ admin pages
│   ├── seller/       # 13 seller pages
│   ├── cart/         # Giỏ hàng
│   ├── checkout/     # Checkout flow
│   ├── orders/       # Buyer orders
│   ├── wallet/       # Ví điện tử
│   ├── mlm/          # MLM network
│   └── ...
├── components/       # React components (by domain)
│   ├── ui/           # Shared primitives
│   ├── layout/       # Header, Footer, Sidebar
│   ├── providers/    # Context providers (7)
│   ├── guards/       # Auth/role guards
│   └── ...           # 15+ domain folders
├── lib/              # Utilities & logic
│   ├── api/          # API client + 20 domain modules
│   ├── queries/      # TanStack Query hooks
│   ├── stores/       # Zustand (cart, wishlist)
│   ├── validations/  # Zod schemas
│   ├── i18n/         # Internationalization (vi/en/zh-TW)
│   └── ...
└── public/           # Static assets
```

## Authentication

- Cookie-based JWT (httpOnly) — tự động gửi qua `credentials: "include"`
- Auto-refresh: khi access_token hết hạn → silent refresh → retry request
- Roles: BUYER, SELLER, WAREHOUSE, CS, ACCOUNTANT, ADMIN, SUPER_ADMIN
- Permission-based UI: ẩn/hiện components theo `user.permissions`

## Docker

```bash
# Build production image (standalone ~100MB)
docker build -t mq-shop .

# Run
docker run -p 3000:3000 -e NEXT_PUBLIC_API_HOST=https://api.example.com mq-shop
```

## Environment Variables

| Variable | Required | Mô tả |
|----------|----------|--------|
| `NEXT_PUBLIC_API_HOST` | Yes | Backend API URL (e.g. `http://localhost:3000`) |

## Tài liệu chi tiết

| Tài liệu | Nội dung |
|-----------|----------|
| [docs/architecture.md](docs/architecture.md) | Tech stack, folder structure, design patterns |
| [docs/pages-routing.md](docs/pages-routing.md) | 60+ routes, layouts, guards |
| [docs/state-management.md](docs/state-management.md) | React Query + Zustand, caching |
| [docs/components.md](docs/components.md) | Component library, UI patterns |
| [docs/api-integration.md](docs/api-integration.md) | API client, auth flow, error handling |
| [docs/deployment.md](docs/deployment.md) | Docker, performance, production |

## I18n

| Locale | Ngôn ngữ |
|--------|----------|
| `vi` | Tiếng Việt |
| `en` | English |
| `zh-TW` | 繁體中文 |

## License

Private — All rights reserved.
