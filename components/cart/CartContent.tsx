"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Trash2, Store } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/data/products";
import { useCart } from "@/components/providers/CartProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import type { CartLine } from "@/lib/stores/cart-store";

// ─── helpers ────────────────────────────────────────────────────────────────

function groupByShop(items: CartLine[]): { shopId: string; shopName: string; lines: CartLine[] }[] {
  const map = new Map<string, { shopId: string; shopName: string; lines: CartLine[] }>();
  for (const item of items) {
    const existing = map.get(item.shopId);
    if (existing) {
      existing.lines.push(item);
    } else {
      map.set(item.shopId, {
        shopId: item.shopId,
        shopName: item.shopName || item.shopId,
        lines: [item],
      });
    }
  }
  return [...map.values()];
}

function stockLabel(
  inStock: number | undefined,
  t: (key: string) => string,
): { label: string; tone: "warn" | "error" } | null {
  if (inStock === undefined) return null;
  if (inStock <= 0) return { label: t("cart.outOfStock"), tone: "error" };
  if (inStock <= 5) return { label: `${t("cart.lowStock")} (${inStock})`, tone: "warn" };
  return null;
}

// ─── sub-components ─────────────────────────────────────────────────────────

function VariantBadges({ options }: { options: Record<string, string> }) {
  const entries = Object.entries(options);
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] leading-none bg-mq-surface-subtle border border-mq-border text-mq-text-secondary"
        >
          <span className="text-mq-text-muted">{k}:</span>
          <span>{v}</span>
        </span>
      ))}
    </div>
  );
}

function PriceDisplay({
  unitPrice,
  originalPrice,
  quantity,
}: {
  unitPrice: number;
  originalPrice?: number;
  quantity: number;
}) {
  const total = unitPrice * quantity;
  const hasDiscount = originalPrice !== undefined && originalPrice > unitPrice;

  return (
    <div className="shrink-0 text-right">
      <p className="text-sm font-semibold text-mq-text">{formatPrice(total)}</p>
      {hasDiscount && (
        <p className="text-xs text-mq-text-muted line-through mt-0.5">
          {formatPrice(originalPrice! * quantity)}
        </p>
      )}
      {quantity > 1 && (
        <p className="text-[11px] text-mq-text-muted mt-0.5">
          {formatPrice(unitPrice)} / item
        </p>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export function CartContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const { items, itemCount, updateQuantity, removeItem, clearCart, setSelectedVariantIds } = useCart();

  // Selection state: Set of variantIds that are checked.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.variantId)));
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Derived groups
  const groups = useMemo(() => groupByShop(items), [items]);

  // Computed selection totals
  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.variantId)),
    [items, selected],
  );
  const selectedCount = useMemo(
    () => selectedItems.reduce((s, i) => s + i.quantity, 0),
    [selectedItems],
  );
  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [selectedItems],
  );

  // Global checkbox state
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.variantId));
  const someSelected = !allSelected && items.some((i) => selected.has(i.variantId));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.variantId)));
    }
  };

  const toggleShop = (shopId: string) => {
    const shopVariantIds = groups
      .find((g) => g.shopId === shopId)
      ?.lines.map((l) => l.variantId) ?? [];
    const allShopSelected = shopVariantIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShopSelected) {
        shopVariantIds.forEach((id) => next.delete(id));
      } else {
        shopVariantIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleItem = (variantId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  };

  const handleRemove = (variantId: string) => {
    removeItem(variantId);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(variantId);
      return next;
    });
  };

  // ── empty state
  if (itemCount === 0) {
    return (
      <>
        <PageHero title={t("cart.title")} breadcrumb={[{ label: t("nav.cart") }]} />
        <Container className="py-16 md:py-24 text-center">
          <div className="max-w-md mx-auto">
            <ShoppingBag className="w-16 h-16 mx-auto text-mq-text-muted mb-6" strokeWidth={1} />
            <h2 className="text-xl text-mq-text mb-3">{t("cart.emptyTitle")}</h2>
            <p className="text-mq-text-secondary mb-8">{t("cart.emptyDesc")}</p>
            <Link href="/shop" className="mq-btn mq-btn-primary">
              {t("cart.returnToShop")}
            </Link>
          </div>
        </Container>
      </>
    );
  }

  return (
    <>
      <PageHero title={t("cart.title")} breadcrumb={[{ label: t("nav.cart") }]} />

      {/* Extra bottom padding so the sticky bar doesn't overlap content */}
      <Container className="py-10 md:py-16 pb-36">
        {/* ── shop groups ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {groups.map((group) => {
            const shopVariantIds = group.lines.map((l) => l.variantId);
            const allShopSelected = shopVariantIds.every((id) => selected.has(id));
            const someShopSelected =
              !allShopSelected && shopVariantIds.some((id) => selected.has(id));

            return (
              <section
                key={group.shopId}
                className="border border-mq-border rounded-[var(--mq-radius-lg)] bg-mq-surface overflow-hidden shadow-[var(--mq-shadow-sm)]"
              >
                {/* ── shop header ── */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-mq-border bg-mq-surface-subtle">
                  {/* shop select-all checkbox */}
                  <input
                    type="checkbox"
                    className="mq-checkbox"
                    checked={allShopSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someShopSelected;
                    }}
                    onChange={() => toggleShop(group.shopId)}
                    aria-label={`Select all items from ${group.shopName}`}
                  />
                  <Store size={15} className="text-mq-text-muted shrink-0" />
                  <span className="text-sm font-semibold text-mq-text flex-1 truncate">
                    {group.shopName}
                  </span>
                  <Link
                    href={`/shops/${group.shopId}`}
                    className="text-xs text-mq-gold hover:underline shrink-0 flex items-center gap-1"
                  >
                    {t("cart.viewShop")}
                  </Link>
                </div>

                {/* ── product rows ── */}
                <ul className="divide-y divide-mq-border">
                  {group.lines.map((item) => {
                    const stock = stockLabel(item.inStock, t);
                    const isSelected = selected.has(item.variantId);

                    return (
                      <li
                        key={item.variantId}
                        className={`flex gap-3 px-4 py-4 transition-colors ${
                          isSelected ? "" : "opacity-60"
                        }`}
                      >
                        {/* item checkbox */}
                        <div className="flex items-start pt-1 shrink-0">
                          <input
                            type="checkbox"
                            className="mq-checkbox"
                            checked={isSelected}
                            onChange={() => toggleItem(item.variantId)}
                            aria-label={`Select ${item.name}`}
                          />
                        </div>

                        {/* product image */}
                        <Link
                          href={`/product/${item.productId}`}
                          className="relative w-20 h-24 sm:w-24 sm:h-[7.5rem] shrink-0 mq-product-image-bg mq-product-media rounded overflow-hidden"
                        >
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            className="mq-product-media-img"
                            sizes="96px"
                          />
                        </Link>

                        {/* details */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          {/* name */}
                          <Link
                            href={`/product/${item.productId}`}
                            className="text-sm text-mq-text hover:text-mq-gold transition-colors line-clamp-2 leading-snug"
                          >
                            {item.name}
                          </Link>

                          {/* variant options */}
                          {item.variantOptions &&
                            Object.keys(item.variantOptions).length > 0 && (
                              <VariantBadges options={item.variantOptions} />
                            )}

                          {/* unit price row */}
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-sm font-medium text-mq-text">
                              {formatPrice(item.unitPrice)}
                            </span>
                            {item.originalPrice !== undefined &&
                              item.originalPrice > item.unitPrice && (
                                <span className="text-xs text-mq-text-muted line-through">
                                  {formatPrice(item.originalPrice)}
                                </span>
                              )}
                          </div>

                          {/* stock status */}
                          {stock && (
                            <p
                              className={`text-xs font-medium ${
                                stock.tone === "error"
                                  ? "text-red-500"
                                  : "text-orange-500"
                              }`}
                            >
                              {stock.label}
                            </p>
                          )}

                          {/* stepper + delete */}
                          <div className="flex items-center gap-3 mt-1">
                            <QuantityStepper
                              value={item.quantity}
                              min={1}
                              max={
                                item.inStock !== undefined && item.inStock > 0
                                  ? item.inStock
                                  : undefined
                              }
                              onChange={(next) => updateQuantity(item.variantId, next)}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemove(item.variantId)}
                              className="text-mq-text-muted hover:text-red-500 transition-colors"
                              aria-label={t("cart.removeItem")}
                            >
                              <Trash2 size={16} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>

                        {/* line total */}
                        <PriceDisplay
                          unitPrice={item.unitPrice}
                          originalPrice={item.originalPrice}
                          quantity={item.quantity}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {/* ── clear cart link ── */}
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={() => setClearConfirmOpen(true)}
            className="text-xs uppercase tracking-wider text-mq-text-muted hover:text-mq-text"
          >
            {t("cart.clearCart")}
          </button>
        </div>
      </Container>

      {/* ── sticky bottom bar ─────────────────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-mq-border bg-mq-surface shadow-[0_-2px_16px_rgba(0,0,0,0.08)]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* global select-all */}
          <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mq-checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={toggleAll}
            />
            <span className="text-sm text-mq-text">{t("cart.selectAll")}</span>
          </label>

          {/* selected count */}
          <span className="text-sm text-mq-text-secondary">
            {t("cart.selectedCount").replace("{count}", String(selectedCount))}
          </span>

          {/* spacer */}
          <div className="flex-1" />

          {/* subtotal */}
          <div className="text-right shrink-0">
            <p className="text-xs text-mq-text-muted leading-none mb-0.5">
              {t("cart.subtotal")}
            </p>
            <p className="text-lg font-semibold text-mq-text leading-none">
              {formatPrice(selectedSubtotal)}
            </p>
          </div>

          {/* checkout CTA */}
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => {
              // Persist the current selection into the store so CheckoutContent
              // can filter to only these lines.
              setSelectedVariantIds(
                selectedCount === itemCount
                  ? null  // all selected → no filter needed
                  : [...selected],
              );
              router.push("/checkout");
            }}
            className={`mq-btn mq-btn-primary shrink-0 ${
              selectedCount === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
            aria-disabled={selectedCount === 0}
          >
            {t("cart.checkout")} ({selectedCount})
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirmOpen}
        title={t("confirm.clearCartTitle")}
        description={t("confirm.clearCartDesc")}
        confirmLabel={t("confirm.clearCartBtn")}
        tone="warn"
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={() => {
          clearCart();
          setSelected(new Set());
          toast.success(t("cart.clearCart"));
          setClearConfirmOpen(false);
        }}
      />
    </>
  );
}
