"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, RotateCcw, ShoppingBag, User } from "lucide-react";
import { useCsCustomerDetail, useCsCustomerOrders } from "@/lib/queries/cs";
import { formatMoneyLocale } from "@/lib/i18n/locale-format";
import { LedgerTwdNote } from "@/components/finance/LedgerTwdNote";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateRoles, translateStatus } from "@/lib/i18n/status";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Skeleton } from "@/components/ui/Skeleton";

function CustomerDetailInner() {
  const { t, locale } = useLanguage();
  const params = useParams();
  const userId = params.id as string;
  const [ordersPage, setOrdersPage] = useState(1);

  const { data: customer, isLoading, isError } = useCsCustomerDetail(userId);
  const { data: ordersData, isLoading: ordersLoading } = useCsCustomerOrders(userId, ordersPage);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="mq-alert mq-alert-error">
        {t("admin.customersPage.empty")}
      </div>
    );
  }

  const orders = ordersData?.items ?? [];
  const ordersMeta = ordersData?.meta;

  return (
    <>
      <AdminPageHeader
        title={customer.fullName || customer.email}
        description={customer.email}
        actions={
          <Link href="/admin/customers" className="mq-admin-btn mq-admin-btn-secondary">
            <ArrowLeft size={16} />
            {t("admin.common.back")}
          </Link>
        }
      />

      <div className="space-y-6">
        {/* Profile card */}
        <div className="mq-card p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-mq-surface-subtle flex items-center justify-center">
              <User size={24} className="text-mq-text-muted" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <h2 className="text-lg font-semibold text-mq-text">
                  {customer.fullName || "—"}
                </h2>
                <p className="text-sm text-mq-text-muted">{customer.email}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className={`mq-badge ${
                    customer.status === "ACTIVE"
                      ? "mq-badge-teal"
                      : customer.status === "LOCKED"
                        ? "mq-badge-pink"
                        : "mq-badge-muted"
                  }`}
                >
                  {translateStatus(t, "user", customer.status)}
                </span>
                <span className="mq-badge mq-badge-muted">
                  {translateRoles(t, customer.roles)}
                </span>
              </div>
              <p className="text-xs text-mq-text-muted">
                {t("admin.customersPage.memberSince")}:{" "}
                {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="mq-card p-4 flex items-center gap-3">
            <ShoppingBag size={20} className="text-mq-text-muted" />
            <div>
              <p className="text-xs text-mq-text-muted">{t("admin.customersPage.totalOrders")}</p>
              <p className="text-xl font-semibold tabular-nums">{customer.stats.totalOrders}</p>
            </div>
          </div>
          <div className="mq-card p-4 flex items-center gap-3">
            <RotateCcw size={20} className="text-mq-text-muted" />
            <div>
              <p className="text-xs text-mq-text-muted">{t("admin.customersPage.totalRma")}</p>
              <p className="text-xl font-semibold tabular-nums">{customer.stats.totalRma}</p>
            </div>
          </div>
        </div>

        {/* Recent orders from detail endpoint */}
        {customer.recentOrders.length > 0 && (
          <div className="mq-card">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <Package size={16} className="text-mq-text-muted" />
              <h3 className="text-sm font-semibold text-mq-text">
                {t("admin.customersPage.recentOrders")}
              </h3>
            </div>
            <OrderTable
              orders={customer.recentOrders}
              locale={locale}
              t={t}
            />
          </div>
        )}

        {/* Full paginated order history */}
        <div className="mq-card">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-mq-text">
              {t("admin.customersPage.allOrders")}
            </h3>
            <LedgerTwdNote className="mt-1" />
          </div>
          {ordersLoading ? (
            <div className="p-4">
              <Skeleton className="h-32 rounded-lg" />
            </div>
          ) : orders.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-mq-text-muted">
              {t("admin.customersPage.noOrders")}
            </p>
          ) : (
            <>
              <OrderTable orders={orders} locale={locale} t={t} />
              <div className="px-4 pb-4">
                <PaginationBar
                  page={ordersPage}
                  meta={ordersMeta}
                  onPageChange={setOrdersPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function OrderTable({
  orders,
  locale,
  t,
}: {
  orders: Array<{ id: string; code: string; status: string; total: string; currency: string; createdAt: string }>;
  locale: import("@/lib/i18n/types").Locale | null;
  t: (key: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mq-border text-xs text-mq-text-muted">
            <th className="text-left px-4 py-2 font-medium">{t("admin.customersPage.orderCode")}</th>
            <th className="text-left px-4 py-2 font-medium">{t("admin.common.status")}</th>
            <th className="text-right px-4 py-2 font-medium">{t("admin.customersPage.orderTotal")}</th>
            <th className="text-right px-4 py-2 font-medium">{t("admin.customersPage.orderDate")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-mq-border last:border-0">
              <td className="px-4 py-2 text-xs">{o.code}</td>
              <td className="px-4 py-2">
                <span className="mq-badge mq-badge-muted text-[10px]">
                  {translateStatus(t, "order", o.status)}
                </span>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatMoneyLocale(o.total, locale)}
              </td>
              <td className="px-4 py-2 text-right text-xs text-mq-text-muted">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminCustomerDetailPage() {
  return (
    <AuthGuard
      roles={["CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]}
      permissions={["VIEW_CUST_DATA"]}
    >
      <CustomerDetailInner />
    </AuthGuard>
  );
}
