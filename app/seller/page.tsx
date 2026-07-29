"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { SellerDashboard } from "@/components/seller/SellerDashboard";

export default function SellerPage() {
  const { hasRole } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const warehouseOnly = hasRole("WAREHOUSE") && !hasRole("SELLER");

  useEffect(() => {
    if (warehouseOnly) router.replace("/seller/inventory");
  }, [warehouseOnly, router]);

  if (warehouseOnly) {
    return (
      <div className="mq-seller-panel max-w-lg text-sm text-mq-text-muted">
        {t("seller.common.loading")}
      </div>
    );
  }

  if (!hasRole("SELLER")) {
    return (
      <div className="mq-seller-panel max-w-lg">
        <p className="text-sm text-mq-text-secondary mb-4">
          {t("seller.titles.overviewDesc")}
        </p>
        <Link href="/seller/shop" className="mq-btn mq-btn-primary">
          {t("seller.overview.applyShop")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SellerDashboard />

      <div className="grid sm:grid-cols-2 gap-3">
        {(
          [
            ["/seller/wallet", "seller.overview.walletCard"],
            ["/seller/shop", "seller.overview.myShop"],
            ["/seller/products", "seller.overview.manageProducts"],
            ["/seller/inventory", "seller.overview.inventoryCard"],
            ["/seller/orders", "seller.overview.ordersCard"],
            ["/seller/settlements", "seller.overview.settlementsCard"],
            ["/seller/transactions", "seller.overview.transactionsCard"],
            ["/seller/landing-cost", "seller.overview.landingCostCard"],
            ["/seller/promotions", "seller.overview.promotionsCard"],
            ["/seller/rma", "seller.overview.rmaCard"],
            ["/seller/materials", "seller.overview.materialsCard"],
          ] as const
        ).map(([href, labelKey]) => (
          <Link
            key={href}
            href={href}
            className="mq-seller-panel !min-h-0 hover:border-[#e7ba0a] transition-colors"
          >
            <span className="text-sm font-medium">{t(labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
