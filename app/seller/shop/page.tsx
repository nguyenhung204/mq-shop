"use client";

import { FormEvent, useState } from "react";
import { useApplyShop, useSellerShop, sellerKeys } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { Container, PageHero } from "@/components/ui/shared";
import { ShopCardSkeleton } from "@/components/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";

function reasonText(reason: unknown): string {
  if (!reason) return "";
  if (typeof reason === "string") return reason;
  if (typeof reason === "object" && reason !== null) {
    const r = reason as Record<string, string>;
    return r.vi || r.en || r["zh-TW"] || "";
  }
  return "";
}

function ShopInner() {
  const queryClient = useQueryClient();
  const { data: shop, isLoading, isError, error } = useSellerShop();
  const applyShop = useApplyShop();
  const [form, setForm] = useState({
    name: "",
    taxId: "",
    countryCode: "VN",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const apply = async (e: FormEvent) => {
    e.preventDefault();
    if (!documentFile) return;
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("taxId", form.taxId);
    fd.append("countryCode", form.countryCode);
    fd.append("document", documentFile);
    await applyShop.mutateAsync(fd);
  };

  const canReapply = shop?.status === "REJECTED" && !shop.isSuspended;
  const reason = reasonText(shop?.rejectionReason);

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
        {!isLoading && shop && (
          <div className="mq-card p-6 space-y-3 mb-6">
            <h2 className="text-xl">{shop.name}</h2>
            <span className="mq-badge mq-badge-cyan">{shop.status}</span>
            {(shop.violationFlag || shop.contactAdminRequired || shop.isSuspended) && (
              <div className="mq-alert mq-alert-error text-sm">
                Contact admin required — shop may be suspended or flagged.
              </div>
            )}
            <p className="text-sm text-mq-text-secondary">
              Tax: {shop.taxId || shop.taxCode} · {shop.countryCode}
            </p>
            {reason && <p className="text-sm text-mq-accent-pink">Reason: {reason}</p>}
            {shop.status === "PENDING" && (
              <p className="text-sm text-mq-text-muted">Waiting for admin approval…</p>
            )}
            {shop.status === "APPROVED" && !shop.isSuspended && (
              <p className="text-sm text-mq-text-muted">
                Shop approved. Refresh session if Seller menus are missing.
              </p>
            )}
            <button
              type="button"
              className="mq-btn mq-btn-outline text-xs"
              onClick={() => void queryClient.invalidateQueries({ queryKey: sellerKeys.shop() })}
            >
              Refresh
            </button>
          </div>
        )}

        {(!shop || canReapply) && !isLoading && (
          <form className="mq-card p-6 space-y-3" onSubmit={(e) => void apply(e)}>
            <h2 className="text-lg">{canReapply ? "Resubmit application" : "Apply to open a shop"}</h2>
            <input
              className="mq-input"
              placeholder="Shop name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
              maxLength={100}
            />
            <input
              className="mq-input"
              placeholder="Tax ID (1–15 digits)"
              value={form.taxId}
              onChange={(e) =>
                setForm({ ...form, taxId: e.target.value.replace(/\D/g, "").slice(0, 15) })
              }
              required
            />
            <input
              className="mq-input"
              placeholder="Country code"
              value={form.countryCode}
              onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
              maxLength={2}
              required
            />
            <input
              className="mq-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              required={!canReapply}
            />
            <p className="text-xs text-mq-text-muted">Document ≤5MB (JPEG/PNG/WebP/PDF)</p>
            <button className="mq-btn mq-btn-primary w-full" disabled={applyShop.isPending || !documentFile}>
              {applyShop.isPending ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}
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
