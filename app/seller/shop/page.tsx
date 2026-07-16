"use client";

import { FormEvent, useState } from "react";
import { useApplyShop, useSellerShop } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { ShopCardSkeleton } from "@/components/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { sellerKeys } from "@/lib/queries/seller";

function ShopInner() {
  const { locale } = useLanguage();
  const lang = locale === "zh-TW" ? "zh-TW" : locale === "en" ? "en" : "vi";
  const queryClient = useQueryClient();
  const { data: shop, isLoading, isError, error } = useSellerShop();
  const applyShop = useApplyShop();
  const [form, setForm] = useState({
    name: "",
    taxCode: "",
    countryCode: "VN",
    pickupAddress: "",
    legalDocumentUrl: "",
  });

  const apply = async (e: FormEvent) => {
    e.preventDefault();
    await applyShop.mutateAsync(form);
  };

  const reason =
    shop?.rejectionReason?.[lang] ||
    shop?.rejectionReason?.vi ||
    "";

  return (
    <>
      <PageHero title="My shop" breadcrumb={[{ label: "Seller", href: "/seller" }, { label: "Shop" }]} />
      <Container className="py-10 max-w-xl">
        <SellerNav />
        {isError && shop !== null && (
          <div className="mq-alert mq-alert-error mb-4">
            {error instanceof Error ? error.message : "Failed to load shop"}
          </div>
        )}
        {isLoading && <ShopCardSkeleton />}
        {!isLoading && shop ? (
          <div className="mq-card p-6 space-y-3">
            <h2 className="text-xl">{shop.name}</h2>
            <span className="mq-badge mq-badge-cyan">{shop.status}</span>
            <p className="text-sm text-mq-text-secondary">Tax: {shop.taxCode} · {shop.countryCode}</p>
            <p className="text-sm">{shop.pickupAddress}</p>
            {reason && <p className="text-sm text-mq-accent-pink">Reason: {reason}</p>}
            {shop.status === "APPROVED" && (
              <p className="text-sm text-mq-text-muted">If you just got approved, sign out and sign in again to refresh SELLER role in JWT.</p>
            )}
            <button
              type="button"
              className="mq-btn mq-btn-outline text-xs"
              onClick={() => void queryClient.invalidateQueries({ queryKey: sellerKeys.shop() })}
            >
              Refresh
            </button>
          </div>
        ) : !isLoading ? (
          <form className="mq-card p-6 space-y-3" onSubmit={(e) => void apply(e)}>
            <input className="mq-input" placeholder="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="mq-input" placeholder="Tax code (1–15 digits)" value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value.replace(/\D/g, "").slice(0, 15) })} required />
            <input className="mq-input" placeholder="Country code" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} maxLength={2} required />
            <textarea className="mq-textarea" placeholder="Pickup address" value={form.pickupAddress} onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })} required />
            <input className="mq-input" placeholder="Legal document URL" value={form.legalDocumentUrl} onChange={(e) => setForm({ ...form, legalDocumentUrl: e.target.value })} />
            <button className="mq-btn mq-btn-primary w-full" disabled={applyShop.isPending}>
              {applyShop.isPending ? "Submitting…" : "Submit application"}
            </button>
          </form>
        ) : null}
      </Container>
    </>
  );
}

export default function SellerShopPage() {
  return (
    <AuthGuard>
      <ShopInner />
    </AuthGuard>
  );
}
