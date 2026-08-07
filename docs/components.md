# Components — MQ Shop

## 1. Tổng quan

Components được tổ chức theo domain và tái sử dụng:

```
components/
├── ui/            # Shared primitives (buttons, inputs, modals)
├── layout/        # App shell, header, footer, sidebar
├── providers/     # Context providers
├── guards/        # Auth/permission guards
├── admin/         # Admin panel components
├── seller/        # Seller dashboard components
├── home/          # Homepage sections
├── product/       # Product display (cards, carousel, detail)
├── cart/          # Cart drawer, cart page
├── orders/        # Order list, detail, status
├── wallet/        # Wallet balance, transactions
├── finance/       # Finance dashboards
├── inventory/     # Stock management UI
├── reviews/       # Review cards, forms
├── auth/          # Login/register forms
├── account/       # Account settings
├── shop/          # Shop profile components
├── super-admin/   # Super admin specific
└── i18n/          # Language switcher
```

---

## 2. UI Primitives (`components/ui/`)

### Danh sách Components

| Component | File | Mô tả |
|-----------|------|--------|
| `ProductCard` | ProductCard.tsx | Card sản phẩm (image, name, price, rating) |
| `ProductCarousel` | ProductCarousel.tsx | Carousel ảnh sản phẩm |
| `PaginationBar` | PaginationBar.tsx | Pagination controls |
| `QuantityStepper` | QuantityStepper.tsx | +/- quantity input |
| `ConfirmDialog` | ConfirmDialog.tsx | Confirm action modal |
| `SearchableSelect` | SearchableSelect.tsx | Dropdown with search |
| `CountrySelect` | CountrySelect.tsx | Country picker |
| `PhoneInput` | PhoneInput.tsx | Phone number input with country code |
| `AddressRegionFields` | AddressRegionFields.tsx | City/District/Ward cascading selects |
| `PageHero` | PageHero.tsx | Page header banner |
| `SaleCountdown` | SaleCountdown.tsx | Countdown timer for promotions |
| `Skeleton` | Skeleton.tsx | Loading skeleton placeholder |
| `AppToaster` | AppToaster.tsx | Toast notification container (Sonner) |
| `icons` | icons.tsx | Custom icon components |
| `shared` | shared.tsx | Shared utility components |

### Design System

| Aspect | Approach |
|--------|----------|
| Styling | TailwindCSS 4 utility classes |
| Icons | Lucide React |
| Toasts | Sonner |
| Fonts | Nunito Sans (body) + Figtree (headings) |
| Colors | TailwindCSS theme (dark/light mode) |
| Spacing | TailwindCSS spacing scale |
| Responsive | Mobile-first breakpoints |

---

## 3. Layout Components (`components/layout/`)

### AppShell

Wrapper cho toàn app, bao gồm:
- Header (logo, navigation, cart badge, user menu)
- Main content area
- Footer

### Admin Layout

- Sidebar navigation (collapsible)
- Top bar (breadcrumb, user info, notifications)
- Permission-based menu items
- Responsive: sidebar drawer on mobile

### Seller Layout

- Seller-specific sidebar
- Shop info header
- Quick stats bar

---

## 4. Provider Components (`components/providers/`)

| Provider | Mô tả | State |
|----------|--------|-------|
| `AuthProvider` | Authentication context | User, loading, permissions |
| `CartProvider` | Cart hydration | Zustand store sync |
| `QueryProvider` | React Query client | Query cache |
| `ThemeProvider` | Dark/light mode | Theme preference |
| `LanguageProvider` | i18n context | Current locale |
| `NotificationProvider` | Real-time notifications | SSE connection, badge count |
| `WishlistProvider` | Wishlist hydration | Zustand store sync |

---

## 5. Guard Components (`components/guards/`)

Guards bảo vệ routes/components dựa trên auth state:

```tsx
// Ví dụ sử dụng
<RequireAuth>
  <RequireRole roles={["ADMIN", "SUPER_ADMIN"]}>
    <AdminDashboard />
  </RequireRole>
</RequireAuth>
```

| Guard | Logic |
|-------|-------|
| RequireAuth | Redirect `/my-account` nếu chưa login |
| RequireRole | Check user.roles contains required role |
| RequirePermission | Check user.permissions via hasPermission() |

---

## 6. Domain Components

### 6.1 Product (`components/product/`)

| Component | Mô tả |
|-----------|--------|
| ProductGrid | Grid layout hiển thị ProductCards |
| ProductDetail | Full PDP: images, info, variants, add-to-cart |
| VariantSelector | Chọn variant (color, size, etc.) |
| PriceDisplay | Hiển thị giá (original + discounted) |
| StockBadge | Trạng thái tồn kho |
| ReviewSection | Reviews dưới PDP |

### 6.2 Cart (`components/cart/`)

| Component | Mô tả |
|-----------|--------|
| CartDrawer | Slide-out cart summary |
| CartPage | Full cart page với line items |
| CartItem | Individual cart line |
| FlyToCartProvider | Animation khi add to cart |
| CartSummary | Subtotal, shipping estimate, total |

### 6.3 Orders (`components/orders/`)

| Component | Mô tả |
|-----------|--------|
| OrderList | Tabbed list (by status) |
| OrderCard | Order summary card |
| OrderDetail | Full order detail + items + history |
| OrderStatusBadge | Colored status indicator |
| OrderTimeline | Status progression timeline |

### 6.4 Wallet (`components/wallet/`)

| Component | Mô tả |
|-----------|--------|
| WalletBalance | Balance card (available + frozen) |
| TransactionList | Transaction history table |
| TransferForm | P2P transfer form |
| WithdrawForm | Payout request form |
| WalletPinDialog | PIN entry modal |

### 6.5 Admin (`components/admin/`)

| Component | Mô tả |
|-----------|--------|
| DashboardCards | KPI cards (revenue, orders, users) |
| DataTable | Generic sortable/filterable table |
| ApproveRejectButtons | Dual-action buttons |
| UserRoleEditor | Role assignment UI |
| AuditLogViewer | Log table with filters |
| ChartWidgets | Recharts-based charts |

### 6.6 Seller (`components/seller/`)

| Component | Mô tả |
|-----------|--------|
| SellerDashboard | Revenue, order stats |
| ProductForm | Create/edit product form |
| InventoryTable | Stock management table |
| OrderFulfillment | Status update workflow |
| SettlementHistory | Payout history |

---

## 7. Component Patterns

### 7.1 Data Table Pattern

```tsx
function OrdersTable() {
  const { data, isLoading } = useOrders(filters);
  
  if (isLoading) return <Skeleton />;
  
  return (
    <>
      <FilterBar ... />
      <Table data={data.items} columns={columns} />
      <PaginationBar meta={data.meta} />
    </>
  );
}
```

### 7.2 Form Pattern

```tsx
function CheckoutForm() {
  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
  });
  const mutation = useCheckoutMutation();

  const onSubmit = (data: CheckoutInput) => {
    mutation.mutate(data, {
      onSuccess: () => router.push("/orders"),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* form fields */}
    </form>
  );
}
```

### 7.3 Infinite Scroll / Pagination

```tsx
function ProductCatalog() {
  const [page, setPage] = useState(1);
  const { data } = useProductList({ page, pageSize: 20, ...filters });

  return (
    <>
      <ProductGrid products={data?.items ?? []} />
      <PaginationBar
        meta={data?.meta}
        onPageChange={setPage}
      />
    </>
  );
}
```

### 7.4 Optimistic Update

```tsx
const mutation = useMutation({
  mutationFn: updateOrderStatus,
  onMutate: async (newStatus) => {
    await queryClient.cancelQueries({ queryKey: ["orders", orderId] });
    const previous = queryClient.getQueryData(["orders", orderId]);
    queryClient.setQueryData(["orders", orderId], (old) => ({
      ...old, status: newStatus,
    }));
    return { previous };
  },
  onError: (err, vars, context) => {
    queryClient.setQueryData(["orders", orderId], context.previous);
  },
});
```

---

## 8. Accessibility

| Aspect | Implementation |
|--------|---------------|
| Semantic HTML | `<nav>`, `<main>`, `<article>`, `<section>` |
| ARIA labels | Buttons, inputs, dialogs |
| Keyboard navigation | Focus management, tab order |
| Color contrast | TailwindCSS dark/light mode |
| Screen reader | Alt text for images, aria-live for toasts |
| Focus trap | Modal dialogs |
| Skip links | Skip to main content |

---

## 9. Performance Patterns

| Pattern | Mô tả |
|---------|--------|
| Dynamic imports | `next/dynamic` cho heavy components (charts, maps) |
| Image optimization | `next/image` with AVIF/WebP, quality tiers |
| Code splitting | Per-route automatic (App Router) |
| Memoization | `useMemo`, `useCallback` cho expensive computations |
| Virtual scrolling | Cho lists dài (admin tables) |
| Prefetch | `<Link prefetch>` cho navigation anticipation |
| Skeleton UI | Loading states không block layout |
