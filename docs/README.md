# MQ Shop — Tài liệu Kỹ thuật (Frontend)

## Mục lục

| # | Tài liệu | Mô tả |
|---|----------|--------|
| 1 | [architecture.md](./architecture.md) | Kiến trúc tổng quan, tech stack, folder structure |
| 2 | [pages-routing.md](./pages-routing.md) | Danh sách trang, routing, layouts |
| 3 | [state-management.md](./state-management.md) | State management, data fetching, caching |
| 4 | [components.md](./components.md) | Component library, UI patterns |
| 5 | [api-integration.md](./api-integration.md) | API client, authentication flow, error handling |
| 6 | [deployment.md](./deployment.md) | Build, Docker, environment variables |

---

## Giới thiệu nhanh

**MQ Shop** là giao diện người dùng (Frontend) cho nền tảng thương mại điện tử MQ Shopping — hỗ trợ marketplace multi-seller, hệ thống MLM, và ví điện tử nội bộ.

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + TailwindCSS 4
- **State**: Zustand (client) + TanStack React Query (server)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Real-time**: socket.io-client + SSE
- **Deploy**: Docker (standalone output)

---

## Khởi chạy nhanh

```bash
# 1. Install dependencies
npm install

# 2. Tạo file env
cp .env.example .env.local
# Edit NEXT_PUBLIC_API_HOST=http://localhost:3000

# 3. Chạy dev
npm run dev
# → http://localhost:3000 (FE)
# Backend chạy ở http://localhost:3000 (BE port)
```

---

## Các vai trò người dùng trên FE

| Role | Khu vực | Mô tả |
|------|---------|--------|
| Guest | `/`, `/shop`, `/product` | Xem catalog, không mua |
| Buyer | `/cart`, `/checkout`, `/orders`, `/wallet`, `/mlm` | Mua hàng, MLM, ví |
| Seller | `/seller/*` | Quản lý shop, products, inventory, orders |
| Admin | `/admin/*` | Quản trị toàn hệ thống |
| Super Admin | `/super-admin/*` | Full access + role management |
| Staff | `/admin/*` (scoped) | WAREHOUSE, CS, ACCOUNTANT |
