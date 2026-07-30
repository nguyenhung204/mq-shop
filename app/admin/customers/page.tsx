"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { useCsCustomers } from "@/lib/queries/cs";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateRoles, translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";

function CustomersInner() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCsCustomers(search, page);
  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <>
      <AdminPageHeader
        title={t("admin.customersPage.title")}
        description={t("admin.customersPage.description")}
      />

      <div className="space-y-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative max-w-sm flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-mq-text-muted pointer-events-none"
            />
            <input
              className="mq-input pl-9 w-full"
              placeholder={t("admin.customersPage.searchHint")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {!search.trim() ? (
          <div className="flex flex-col items-center justify-center py-16 text-mq-text-muted">
            <Users size={40} strokeWidth={1.25} className="mb-3 opacity-40" />
            <p className="text-sm">{t("admin.customersPage.searchHint")}</p>
          </div>
        ) : isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.customersPage.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.common.email")}</th>
                  <th className="p-3">{t("admin.common.name")}</th>
                  <th className="p-3">{t("admin.common.roles")}</th>
                  <th className="p-3">{t("admin.common.status")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-t border-mq-border">
                    <td className="p-3">{c.email}</td>
                    <td className="p-3">{c.fullName || "—"}</td>
                    <td className="p-3 text-xs">{translateRoles(t, c.roles)}</td>
                    <td className="p-3">
                      <span
                        className={`mq-badge ${
                          c.status === "ACTIVE"
                            ? "mq-badge-teal"
                            : c.status === "LOCKED"
                              ? "mq-badge-pink"
                              : "mq-badge-muted"
                        }`}
                      >
                        {translateStatus(t, "user", c.status)}
                      </span>
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="text-xs text-[#e7ba0a] hover:underline"
                      >
                        {t("admin.customersPage.viewDetail")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {search.trim() && items.length > 0 && (
          <PaginationBar page={page} meta={meta} onPageChange={setPage} />
        )}
      </div>
    </>
  );
}

export default function AdminCustomersPage() {
  return (
    <AuthGuard
      roles={["CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]}
      permissions={["VIEW_CUST_DATA"]}
    >
      <CustomersInner />
    </AuthGuard>
  );
}
