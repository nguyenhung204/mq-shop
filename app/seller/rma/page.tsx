"use client";

import Link from "next/link";
import { useSellerOrders } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { OrderListSkeleton } from "@/components/ui/Skeleton";

function SellerRmaInner() {
  const { t } = useLanguage();
  const { data, isLoading, isError, error } = useSellerOrders({
    status: "REFUND_APPROVED",
    page: 1,
    pageSize: 50,
  });
  const refunded = data?.items ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">{t("seller.rmaPage.intro")}</p>
      {isLoading && <OrderListSkeleton />}
      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : t("admin.common.failed")}
        </div>
      )}
      {refunded.length === 0 && !isLoading ? (
        <p className="text-sm text-mq-text-muted">{t("seller.rmaPage.empty")}</p>
      ) : null}
      {refunded.map((o) => (
        <div key={o.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
          <div>
            <Link href={`/orders/${o.id}`} className="font-mono font-medium hover:underline">
              {o.code}
            </Link>
            <span className="mq-badge mq-badge-pink ml-2">{translateStatus(t, "order", o.status)}</span>
            <p className="text-xs text-mq-text-muted mt-1">
              {t("seller.rmaPage.restockHint")}
            </p>
          </div>
          <Link href="/seller/inventory" className="mq-btn mq-btn-outline text-xs">
            {t("seller.rmaPage.openInventory")}
          </Link>
        </div>
      ))}
    </div>
  );
}

export default function SellerRmaPage() {
  return (
    <AuthGuard roles={["SELLER", "WAREHOUSE"]}>
      <SellerRmaInner />
    </AuthGuard>
  );
}
