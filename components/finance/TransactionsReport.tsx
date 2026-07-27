"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type {
  FinanceExportFormat,
  FinanceTransaction,
  FinanceTransactionType,
} from "@/lib/api/finance";
import { formatMoney } from "@/lib/api/utils";
import { useExportFinanceReport, useFinanceTransactions } from "@/lib/queries/finance";
import { useAdminShops } from "@/lib/queries/admin";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

const TYPES: FinanceTransactionType[] = ["ALL", "ORDER", "PAYOUT"];
const FORMATS: FinanceExportFormat[] = ["CSV", "XLSX"];

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(last).padStart(2, "0")}`,
  };
}

function toPeriodStart(date: string): string {
  return new Date(`${date}T00:00:00.000`).toISOString();
}

function toPeriodEnd(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function typeBadgeClass(type: FinanceTransaction["type"]): string {
  return type === "PAYOUT" ? "mq-badge mq-badge-orange" : "mq-badge mq-badge-cyan";
}

type TransactionsReportProps = {
  /** Admin can filter by shop; seller is scoped by BE. */
  showShopFilter?: boolean;
  /**
   * Buyer SELF scope: ORDER-only filter options, never show export
   * (Buyer has VIEW_TRANSACT but not EXPORT_REPORT).
   */
  buyerMode?: boolean;
  /** Link payout rows to admin payout detail. */
  payoutDetailHref?: (id: string) => string;
};

export function TransactionsReport({
  showShopFilter = false,
  buyerMode = false,
  payoutDetailHref,
}: TransactionsReportProps) {
  const { t } = useLanguage();
  const { hasPermission, hasRole } = useAuth();
  // BE: EXPORT_REPORT = Seller SHOP · Acc/Admin/SA ALL · Buyer none
  const canExport =
    !buyerMode &&
    (hasPermission("EXPORT_REPORT") ||
      hasRole("SELLER") ||
      hasRole("ACCOUNTANT") ||
      hasRole("ADMIN") ||
      hasRole("SUPER_ADMIN"));
  const typeOptions: FinanceTransactionType[] = buyerMode
    ? ["ALL", "ORDER"]
    : TYPES;
  const bounds = monthBounds();

  const [startDate, setStartDate] = useState(bounds.start);
  const [endDate, setEndDate] = useState(bounds.end);
  const [type, setType] = useState<FinanceTransactionType>("ALL");
  const [shopId, setShopId] = useState("");
  const [format, setFormat] = useState<FinanceExportFormat>("CSV");
  const [page, setPage] = useState(1);
  const [filterError, setFilterError] = useState("");

  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100, {
    enabled: showShopFilter,
  });
  const shops = shopsPage?.items ?? [];
  const shopName = useMemo(() => {
    const map = new Map(shops.map((s) => [s.id, s.name]));
    return (id: string | null) => {
      if (!id) return "—";
      return map.get(id) ?? `${id.slice(0, 8)}…`;
    };
  }, [shops]);

  const startIso = startDate ? toPeriodStart(startDate) : undefined;
  const endIso = endDate ? toPeriodEnd(endDate) : undefined;
  const datesOk = Boolean(startDate && endDate && new Date(endDate) >= new Date(startDate));

  const { data, isLoading, isError, error, isFetching } = useFinanceTransactions({
    startDate: startIso,
    endDate: endIso,
    type,
    shopId: showShopFilter && shopId ? shopId : undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  const exportReport = useExportFinanceReport();

  const onExport = () => {
    setFilterError("");
    if (!datesOk || !startIso || !endIso) {
      setFilterError(t("transactions.periodInvalid"));
      return;
    }
    void exportReport.mutateAsync({
      startDate: startIso,
      endDate: endIso,
      type,
      format,
      ...(showShopFilter && shopId ? { shopId } : {}),
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-mq-text-muted">
        {t(buyerMode ? "transactions.introBuyer" : "transactions.intro")}
      </p>

      <div className="mq-card p-4 space-y-3">
        {filterError ? <div className="mq-alert mq-alert-error">{filterError}</div> : null}
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block text-sm">
            <span className="text-mq-text-muted text-xs">{t("transactions.startDate")}</span>
            <input
              type="date"
              className="mq-input mt-1"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-sm">
            <span className="text-mq-text-muted text-xs">{t("transactions.endDate")}</span>
            <input
              type="date"
              className="mq-input mt-1"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="block text-sm">
            <span className="text-mq-text-muted text-xs">{t("transactions.type")}</span>
            <select
              className="mq-input mt-1 !w-[10rem]"
              value={type}
              onChange={(e) => {
                setType(e.target.value as FinanceTransactionType);
                setPage(1);
              }}
            >
              {typeOptions.map((txType) => (
                <option key={txType} value={txType}>
                  {t(`transactions.types.${txType}`)}
                </option>
              ))}
            </select>
          </label>
          {showShopFilter ? (
            <label className="block text-sm">
              <span className="text-mq-text-muted text-xs">{t("admin.common.shop")}</span>
              <select
                className="mq-input mt-1 min-w-[14rem]"
                value={shopId}
                onChange={(e) => {
                  setShopId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("admin.common.allShops")}</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canExport ? (
            <>
              <label className="block text-sm">
                <span className="text-mq-text-muted text-xs">{t("transactions.format")}</span>
                <select
                  className="mq-input mt-1 !w-[8rem]"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as FinanceExportFormat)}
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="mq-btn mq-btn-primary shrink-0"
                disabled={exportReport.isPending || !datesOk}
                onClick={onExport}
              >
                <Download size={16} aria-hidden />
                {exportReport.isPending
                  ? t("transactions.exporting")
                  : t("transactions.export")}
              </button>
            </>
          ) : null}
        </div>
        {canExport ? (
          <p className="text-xs text-mq-text-muted">{t("transactions.exportHint")}</p>
        ) : null}
      </div>

      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : t("admin.common.failed")}
        </div>
      )}

      {(isLoading || isFetching) && items.length === 0 ? (
        <AdminCardListSkeleton count={5} />
      ) : null}

      {!isLoading && items.length === 0 && !isError ? (
        <p className="text-sm text-mq-text-muted py-6 text-center">
          {t("transactions.empty")}
        </p>
      ) : null}

      {items.map((row) => {
        const refLabel = row.ref ?? row.id.slice(0, 8);
        const detail =
          row.type === "ORDER" ? (
            <Link href={`/orders/${row.id}`} className="font-mono hover:underline">
              {refLabel}
            </Link>
          ) : payoutDetailHref ? (
            <Link
              href={payoutDetailHref(row.id)}
              className="font-mono hover:underline"
            >
              {refLabel}
            </Link>
          ) : (
            <span className="font-mono">{refLabel}</span>
          );

        return (
          <div
            key={`${row.type}-${row.id}`}
            className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={typeBadgeClass(row.type)}>
                  {t(`transactions.types.${row.type}`)}
                </span>
                {detail}
                <span className="mq-badge mq-badge-muted">{row.status}</span>
              </div>
              <p className="text-xs text-mq-text-muted">
                {formatWhen(row.occurredAt)}
              </p>
              {(showShopFilter || row.shopName || (!buyerMode && row.shopOwnerName)) && (
                <p className="text-xs text-mq-text-muted">
                  {t("transactions.shop")}:{" "}
                  <span className="text-mq-text">
                    {row.shopName ?? shopName(row.shopId)}
                  </span>
                  {!buyerMode && row.shopOwnerName ? (
                    <>
                      {" · "}
                      {t("transactions.shopOwner")}:{" "}
                      <span className="text-mq-text">{row.shopOwnerName}</span>
                    </>
                  ) : null}
                </p>
              )}
              {!buyerMode && row.type === "ORDER" && row.buyerName ? (
                <p className="text-xs text-mq-text-muted">
                  {t("transactions.buyer")}:{" "}
                  <span className="text-mq-text">{row.buyerName}</span>
                </p>
              ) : null}
            </div>
            <span className="tabular-nums font-medium">{formatMoney(row.amount)}</span>
          </div>
        );
      })}

      {meta && <PaginationBar page={page} meta={meta} onPageChange={setPage} />}
    </div>
  );
}
