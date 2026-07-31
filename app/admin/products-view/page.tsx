"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { ApiProduct, PageMeta } from "@/lib/api/types";
import { parsePage } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";

function ProductsViewInner() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["products-manage", page],
    queryFn: async () =>
      parsePage<ApiProduct>(
        await api.get<ApiProduct[]>("/products", {
          query: { page, pageSize: 20 },
          withMeta: true,
        }),
      ),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <>
      <AdminPageHeader
        title={t("admin.products.title")}
        description={t("admin.products.description")}
      />

      <div className="space-y-6">
        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.productsPage.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.common.name")}</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">{t("admin.common.status")}</th>
                  <th className="p-3">{t("seller.inventoryPage.available")}</th>
                  <th className="p-3">{t("seller.inventoryPage.sellPrice")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-mq-border">
                    <td className="p-3">{p.title}</td>
                    <td className="p-3 font-mono text-xs">
                      {p.variants?.[0]?.sku || "—"}
                    </td>
                    <td className="p-3">
                      <span className="mq-badge mq-badge-muted text-[10px]">
                        {translateStatus(t, "product", p.status)}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums">{p.stock ?? 0}</td>
                    <td className="p-3 tabular-nums">{p.price ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>
    </>
  );
}

export default function AdminProductsViewPage() {
  return (
    <AuthGuard roles={["WAREHOUSE", "ADMIN", "SUPER_ADMIN"]}>
      <ProductsViewInner />
    </AuthGuard>
  );
}
