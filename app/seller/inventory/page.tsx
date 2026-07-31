"use client";

import { FormEvent, Fragment, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import type {
  InventorySlip,
  InventorySlipStatus,
  InventorySlipType,
  InventoryVariant,
  StockLedgerEntry,
  StockLedgerType,
  Warehouse,
} from "@/lib/api/inventory";
import { formatMoney } from "@/lib/api/utils";
import {
  useApproveSlip,
  useCreateSlip,
  useCreateVariant,
  useCreateWarehouse,
  useInventoryLedger,
  useInventorySlip,
  useInventorySlips,
  useInventoryVariants,
  useRejectSlip,
  useTransfers,
  useWarehouseLookup,
  useWarehouses,
  useWarehouseStock,
} from "@/lib/queries/inventory";
import { useSellerProducts } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { formatWarehouseLabel } from "@/lib/inventory/warehouse-label";
import { CountrySelect } from "@/components/ui/CountrySelect";
import {
  AdminActions,
  AdminIconButton,
} from "@/components/admin/AdminIconButton";
import { SlipDetailBody } from "@/components/inventory/SlipDetailBody";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getErrorMessage } from "@/lib/queries/utils";

type TabId = "warehouses" | "transfers" | "variants" | "slips" | "ledger";

const TABS: { id: TabId; labelKey: string }[] = [
  { id: "warehouses", labelKey: "seller.inventoryPage.warehouses" },
  { id: "transfers", labelKey: "seller.transfers.title" },
  { id: "variants", labelKey: "seller.inventoryPage.variants" },
  { id: "slips", labelKey: "seller.inventoryPage.slips" },
  { id: "ledger", labelKey: "seller.inventoryPage.ledger" },
];

const WH_CODE_RE = /^[A-Za-z0-9_-]+$/;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function slipStatusBadge(status: InventorySlipStatus): string {
  switch (status) {
    case "PENDING":
      return "mq-badge mq-badge-cyan";
    case "APPROVED":
      return "mq-badge mq-badge-teal";
    case "REJECTED":
      return "mq-badge mq-badge-pink";
    default:
      return "mq-badge mq-badge-muted";
  }
}

function slipTypeLabel(
  type: StockLedgerType,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  return translateStatus(t, "inventorySlipType", type);
}

function WarehouseStockPanel({ warehouseId }: { warehouseId: string }) {
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useWarehouseStock(warehouseId, { q: q || undefined, page, pageSize: 10 });
  const items = data?.items ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;

  return (
    <div className="rounded-lg border border-mq-border/60 bg-mq-surface-subtle/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-mq-text">
          {t("seller.inventoryPage.variants")} {total > 0 ? `(${total})` : ""}
        </p>
        <div className="relative">
          <input
            className="mq-input !pl-8 !py-1.5 text-xs w-48"
            placeholder={t("seller.inventoryPage.searchSku")}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-mq-text-muted pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-mq-text-muted">
          <span className="inline-block w-3 h-3 border-2 border-mq-text-muted border-t-transparent rounded-full animate-spin" />
          {t("admin.common.loading")}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-mq-text-muted py-3">{t("seller.inventoryPage.noSkus")}</p>
      ) : (
        <>
          <div className="grid gap-2">
            {items.map((item) => {
              const lowStock = item.availableStock <= 5;
              const outOfStock = item.availableStock === 0;
              return (
                <div
                  key={item.warehouseInventoryId}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-xs ${
                    outOfStock
                      ? "border-red-200 bg-red-50/50"
                      : lowStock
                        ? "border-orange-200 bg-orange-50/30"
                        : "border-mq-border/40 bg-white"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-mq-text truncate">{item.productTitle}</p>
                    <p className="text-mq-text-muted font-mono mt-0.5">{item.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-mq-text-muted mb-0.5">{t("seller.inventoryPage.available")}</p>
                    <p className={`font-semibold tabular-nums ${outOfStock ? "text-red-500" : lowStock ? "text-orange-500" : "text-mq-text"}`}>
                      {item.availableStock}
                    </p>
                    {item.reservedStock > 0 && (
                      <p className="text-[10px] text-mq-text-muted">
                        {t("seller.inventoryPage.reservedCount", {
                          count: String(item.reservedStock),
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <p className="text-[10px] text-mq-text-muted mb-0.5">{t("seller.inventoryPage.sellPrice")}</p>
                    <p className="tabular-nums text-mq-text-muted">{formatMoney(item.sellingPrice)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {(meta?.totalPages ?? 0) > 1 && (
            <PaginationBar page={page} meta={meta} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

function TransfersTab() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  // Transfers reference warehouses by id only — resolve to code for display.
  const { byId: warehouseById } = useWarehouseLookup();
  const { data, isLoading } = useTransfers({ page, pageSize: 10 });
  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-mq-text-muted">{t("seller.transfers.description")}</p>
        <Link href="/seller/inventory/transfers" className="mq-btn mq-btn-primary text-xs">
          {t("seller.transfers.title")}
        </Link>
      </div>
      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("seller.transfers.empty")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.code")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.transfers.fromWarehouse")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.transfers.toWarehouse")}</th>
                  <th className="py-2 pr-3 font-medium">{t("admin.common.status")}</th>
                  <th className="py-2 font-medium">{t("seller.inventoryPage.created")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((tr) => (
                  <tr key={tr.id} className="border-b border-mq-border/60">
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      <Link href={`/seller/inventory/transfers/${tr.id}`} className="underline hover:text-[#e7ba0a]">
                        {tr.code || `${tr.id.slice(0, 8)}…`}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      {formatWarehouseLabel(
                        tr.fromWarehouse ?? warehouseById.get(tr.fromWarehouseId),
                        tr.fromWarehouseId,
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      {formatWarehouseLabel(
                        tr.toWarehouse ?? warehouseById.get(tr.toWarehouseId),
                        tr.toWarehouseId,
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`mq-badge ${tr.status === "RECEIVED" ? "mq-badge-teal" : tr.status === "IN_TRANSIT" ? "mq-badge-cyan" : tr.status === "CANCELLED" ? "mq-badge-pink" : "mq-badge-muted"}`}>
                        {translateStatus(t, "transfer", tr.status)}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-mq-text-muted">{new Date(tr.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function WarehousesTab() {
  const { t } = useLanguage();
  const { data: warehouses = [], isLoading, isError, error } = useWarehouses();
  const createWarehouse = useCreateWarehouse();
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [countryCode, setCountryCode] = useState("VN");
  const [formError, setFormError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || trimmed.length > 32 || !WH_CODE_RE.test(trimmed)) {
      setFormError(t("seller.inventoryPage.warehouseCodeHint"));
      return;
    }
    setFormError("");
    try {
      await createWarehouse.mutateAsync({
        code: trimmed,
        address: address.trim() || undefined,
        countryCode,
      });
    } catch {
      return; // toast handled in the mutation; keep the form values for retry
    }
    setCode("");
    setAddress("");
    setCountryCode("VN");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        {t("seller.inventoryPage.warehousesDesc")}
      </p>
      <form
        className="mq-card p-4 flex flex-wrap items-center gap-3"
        onSubmit={(e) => void onSubmit(e)}
      >
        <input
          className="mq-input flex-1 min-w-[140px]"
          placeholder={t("seller.inventoryPage.warehouseCode")}
          value={code}
          maxLength={32}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
        />
        <input
          className="mq-input flex-[2] min-w-[200px]"
          placeholder={t("seller.inventoryPage.warehouseAddress")}
          value={address}
          maxLength={200}
          onChange={(e) => setAddress(e.target.value)}
        />
        <CountrySelect
          className="mq-input w-36"
          value={countryCode}
          onValueChange={setCountryCode}
          aria-label={t("seller.transfers.countryCode")}
        />
        <button
          className="mq-btn mq-btn-primary shrink-0 self-center"
          disabled={createWarehouse.isPending}
        >
          {createWarehouse.isPending ? t("admin.common.working") : t("seller.inventoryPage.addWarehouse")}
        </button>
        {formError ? (
          <p className="w-full text-xs text-mq-text-muted">{formError}</p>
        ) : null}
      </form>

      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      )}
      {isLoading ? (
        <TableSkeleton rows={3} cols={3} />
      ) : warehouses.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("seller.inventoryPage.noWarehouses")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mq-text-muted border-b border-mq-border">
                <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.code")}</th>
                <th className="py-2 pr-3 font-medium">{t("seller.transfers.countryCode")}</th>
                <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.address")}</th>
                <th className="py-2 font-medium">{t("seller.inventoryPage.created")}</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w: Warehouse) => (
                <Fragment key={w.id}>
                <tr
                  className={`border-b border-mq-border/60 cursor-pointer transition-colors ${expandedId === w.id ? "bg-mq-surface-subtle" : "hover:bg-mq-surface-subtle/40"}`}
                  onClick={() => setExpandedId((id) => (id === w.id ? null : w.id))}
                >
                  <td className="py-2.5 pr-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-block w-4 h-4 text-mq-text-muted transition-transform ${expandedId === w.id ? "rotate-90" : ""}`}>▸</span>
                      {w.code}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs">{w.countryCode || "—"}</td>
                  <td className="py-2.5 pr-3 text-mq-text-secondary">{w.address || "—"}</td>
                  <td className="py-2.5 text-mq-text-muted text-xs">
                    {formatDate(w.createdAt)}
                  </td>
                </tr>
                {expandedId === w.id ? (
                  <tr className="border-b border-mq-border/60">
                    <td colSpan={4} className="py-3 px-2">
                      <WarehouseStockPanel warehouseId={w.id} />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VariantsTab() {
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [productId, setProductId] = useState("");
  const [sku, setSku] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [isEnrollmentPackage, setIsEnrollmentPackage] = useState(false);

  const { data: productsPage } = useSellerProducts(undefined, 1, 100);
  const productOptions = productsPage?.items ?? [];

  const { data, isLoading, isError, error } = useInventoryVariants({
    q: q || undefined,
    productId: productFilter || undefined,
    page,
    pageSize: 20,
  });
  const createVariant = useCreateVariant();
  const items = data?.items ?? [];
  const meta = data?.meta;

  const productTitle = (id: string) => {
    const p = productOptions.find((x) => x.id === id);
    return p?.title || p?.name || id.slice(0, 8);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedSku = sku.trim();
    const sell = Number(sellingPrice);
    if (!productId || !trimmedSku || !Number.isFinite(sell) || sell < 0) return;
    let options: Record<string, string> | undefined;
    const trimmedOpts = optionsText.trim();
    if (trimmedOpts) {
      options = {};
      for (const part of trimmedOpts.split(/[,;]/)) {
        const piece = part.trim();
        if (!piece) continue;
        const m = piece.match(/^([^=:]+)\s*[=:]\s*(.+)$/);
        if (!m) return;
        options[m[1].trim()] = m[2].trim();
      }
      if (!Object.keys(options).length) options = undefined;
    }
    try {
      await createVariant.mutateAsync({
        productId,
        sku: trimmedSku,
        sellingPrice: sell,
        options,
        isEnrollmentPackage,
      });
    } catch {
      return; // toast handled in the mutation; keep the form values for retry
    }
    setSku("");
    setSellingPrice("");
    setOptionsText("");
    setIsEnrollmentPackage(false);
    setShowForm(false);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        {t("seller.inventoryPage.preferProductsHintBefore")}{" "}
        <Link href="/seller/products" className="underline">
          {t("seller.inventoryPage.productsLink")}
        </Link>{" "}
        {t("seller.inventoryPage.preferProductsHintAfter")}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="mq-input max-w-xs"
          placeholder={t("seller.inventoryPage.searchSku")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="mq-input max-w-[14rem]"
          value={productFilter}
          aria-label={t("seller.inventoryPage.allProducts")}
          onChange={(e) => {
            setProductFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("seller.inventoryPage.allProducts")}</option>
          {productOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title || p.name || p.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="mq-btn mq-btn-primary ml-auto"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? t("seller.common.cancel") : t("seller.inventoryPage.addSku")}
        </button>
      </div>

      {showForm ? (
        <form className="mq-card p-4 grid sm:grid-cols-2 gap-3" onSubmit={(e) => void onSubmit(e)}>
          <select
            className="mq-input sm:col-span-2"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
          >
            <option value="">{t("seller.inventoryPage.selectProduct")}</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || p.name || p.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <input
            className="mq-input"
            placeholder={t("seller.productsPage.sku")}
            value={sku}
            maxLength={64}
            onChange={(e) => setSku(e.target.value)}
            required
          />
          <input
            className="mq-input"
            type="number"
            min="0"
            step="0.01"
            placeholder={t("seller.inventoryPage.sellPrice")}
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            required
          />
          <input
            className="mq-input sm:col-span-2"
            placeholder={t("seller.productsPage.options")}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isEnrollmentPackage}
              onChange={(e) => setIsEnrollmentPackage(e.target.checked)}
            />
            {t("seller.inventoryPage.enrollmentPackage")}
          </label>
          <button className="mq-btn mq-btn-primary sm:col-span-2" disabled={createVariant.isPending}>
            {createVariant.isPending ? t("admin.common.working") : t("seller.inventoryPage.createSku")}
          </button>
        </form>
      ) : null}

      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      )}
      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("seller.inventoryPage.noSkus")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">{t("seller.productsPage.sku")}</th>
                  <th className="py-2 pr-3 font-medium">{t("admin.common.name")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.sellPrice")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.available")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.reserved")}</th>
                  <th className="py-2 font-medium">{t("seller.inventoryPage.costPrice")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((v: InventoryVariant) => (
                  <tr key={v.id} className="border-b border-mq-border/60">
                    <td className="py-2.5 pr-3 font-medium">{v.sku}</td>
                    <td className="py-2.5 pr-3 text-xs text-mq-text-secondary">
                      {productTitle(v.productId)}
                    </td>
                    <td className="py-2.5 pr-3">{formatMoney(v.sellingPrice)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{v.availableStock}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-mq-text-muted">
                      {v.reservedStock ?? 0}
                    </td>
                    <td className="py-2.5 text-mq-text-secondary">
                      {v.costPrice != null ? formatMoney(v.costPrice) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function slipItemsSummary(s: InventorySlip): string {
  const lines = s.items ?? [];
  if (!lines.length) return "—";
  const first = lines[0];
  const head = `${first.sku} ×${first.quantity}`;
  if (lines.length === 1) return head;
  return `${head} +${lines.length - 1}`;
}

function emptySlipLine() {
  return { key: crypto.randomUUID(), sku: "", quantity: "1", unitCost: "" };
}

function SlipsTab({
  onGoToWarehouses,
  initialSlipId,
}: {
  onGoToWarehouses: () => void;
  /** From `?slipId=` — inventory slip notifications deep-link here. */
  initialSlipId?: string | null;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<InventorySlipStatus | "">("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [detailId, setDetailId] = useState<string | null>(initialSlipId ?? null);
  const [type, setType] = useState<InventorySlipType>("IN");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [lines, setLines] = useState(() => [emptySlipLine()]);

  const { data: warehouses = [], isLoading: warehousesLoading } = useWarehouses();
  const hasNoWarehouses = !warehousesLoading && warehouses.length === 0;
  const { data: variantPage } = useInventoryVariants({ pageSize: 100 });
  const skuOptions = useMemo(
    () => (variantPage?.items ?? []).map((v) => v.sku),
    [variantPage?.items],
  );

  const { data, isLoading, isError, error } = useInventorySlips({
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const detailQuery = useInventorySlip(detailId);
  const createSlip = useCreateSlip();
  const approveSlip = useApproveSlip();
  const rejectSlip = useRejectSlip();
  const [rejectSlipId, setRejectSlipId] = useState<string | null>(null);
  const items = data?.items ?? [];
  const meta = data?.meta;
  const busy = createSlip.isPending || approveSlip.isPending || rejectSlip.isPending;

  const updateLine = (
    key: string,
    patch: Partial<{ sku: string; quantity: string; unitCost: string }>,
  ) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    // warehouseCode is mandatory since multi-warehouse (feat/023) — BE rejects 400 without it.
    if (!warehouseCode.trim()) {
      setFormError(t("seller.inventoryPage.warehouseRequiredError"));
      return;
    }
    const skus = lines.map((l) => l.sku.trim()).filter(Boolean);
    if (!skus.length) {
      setFormError(t("seller.inventoryPage.addSkuLineError"));
      return;
    }
    if (new Set(skus).size !== skus.length) {
      setFormError(t("seller.inventoryPage.duplicateSkuError"));
      return;
    }
    const payloadItems = [];
    for (const line of lines) {
      const sku = line.sku.trim();
      if (!sku) continue;
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setFormError(t("seller.inventoryPage.invalidQuantityError", { sku }));
        return;
      }
      const costRaw = line.unitCost.trim();
      const unitCost = costRaw === "" ? undefined : Number(costRaw);
      if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
        setFormError(t("seller.inventoryPage.invalidUnitCostError", { sku }));
        return;
      }
      payloadItems.push({
        sku,
        quantity,
        unitCost,
      });
    }
    try {
      await createSlip.mutateAsync({
        type,
        warehouseCode,
        locationNote: locationNote.trim() || undefined,
        items: payloadItems,
      });
      setType("IN");
      setWarehouseCode("");
      setLocationNote("");
      setLines([emptySlipLine()]);
      setShowForm(false);
      setStatus("PENDING");
      setPage(1);
    } catch {
      // toast handled in mutation
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">{t("seller.inventoryPage.slipsDesc")}</p>

      {/* Deep-linked slip that is not on the current page — show it standalone. */}
      {detailId && !items.some((s) => s.id === detailId) ? (
        <div className="mq-card p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-mq-text">
              {t("seller.inventoryPage.slips")}
            </p>
            <button
              type="button"
              className="mq-icon-btn text-mq-text-muted"
              aria-label={t("seller.common.cancel")}
              onClick={() => setDetailId(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <SlipDetailBody
            slip={detailQuery.data}
            loading={detailQuery.isLoading}
            error={
              detailQuery.isError
                ? getErrorMessage(detailQuery.error, t("admin.common.failed"))
                : null
            }
          />
        </div>
      ) : null}

      {hasNoWarehouses ? (
        <div className="mq-alert flex flex-wrap items-center justify-between gap-3">
          <span>{t("seller.inventoryPage.needWarehouseFirst")}</span>
          <button
            type="button"
            className="mq-btn mq-btn-outline text-xs shrink-0"
            onClick={onGoToWarehouses}
          >
            {t("seller.inventoryPage.goToWarehouses")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="mq-input max-w-[11rem]"
          aria-label={t("admin.common.filterStatus")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as InventorySlipStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("admin.common.allStatuses")}</option>
          <option value="PENDING">{t("admin.common.pending")}</option>
          <option value="APPROVED">{t("admin.common.approved")}</option>
          <option value="REJECTED">{t("admin.common.rejected")}</option>
        </select>
        <button
          type="button"
          className="mq-btn mq-btn-primary ml-auto"
          disabled={hasNoWarehouses}
          title={hasNoWarehouses ? t("seller.inventoryPage.needWarehouseFirst") : undefined}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? t("seller.common.cancel") : t("seller.inventoryPage.newSlip")}
        </button>
      </div>

      {showForm ? (
        <form className="mq-card p-4 space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <select
              className="mq-input"
              value={type}
              onChange={(e) => setType(e.target.value as InventorySlipType)}
            >
              <option value="IN">{t("seller.inventoryPage.inGoods")}</option>
              <option value="ADJUST_IN">{t("seller.inventoryPage.adjustIn")}</option>
              <option value="ADJUST_OUT">{t("seller.inventoryPage.outGoods")}</option>
            </select>
            <select
              className="mq-input"
              aria-label={t("seller.transfers.selectWarehouse")}
              value={warehouseCode}
              onChange={(e) => setWarehouseCode(e.target.value)}
              required
            >
              <option value="">
                {t("seller.transfers.selectWarehouse")}
              </option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.code}>
                  {w.countryCode ? `[${w.countryCode}] ${w.code}` : w.code}
                </option>
              ))}
            </select>
            <input
              className="mq-input sm:col-span-2"
              placeholder={t("seller.inventoryPage.locationNote")}
              value={locationNote}
              maxLength={300}
              onChange={(e) => setLocationNote(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t("seller.inventoryPage.items")}</h3>
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                onClick={() => setLines((prev) => [...prev, emptySlipLine()])}
              >
                {t("seller.inventoryPage.addLine")}
              </button>
            </div>
            {lines.map((line) => (
              <div
                key={line.key}
                className="grid sm:grid-cols-[1fr_5rem_7rem_auto] gap-2 items-center"
              >
                <select
                  className="mq-input"
                  value={line.sku}
                  onChange={(e) => updateLine(line.key, { sku: e.target.value })}
                  required
                >
                  <option value="">{t("seller.promotions.addSku")}</option>
                  {skuOptions.map((sku) => (
                    <option key={sku} value={sku}>
                      {sku}
                    </option>
                  ))}
                </select>
                <input
                  className="mq-input"
                  type="number"
                  min={1}
                  step={1}
                  aria-label={t("seller.inventoryPage.quantity")}
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  required
                />
                <input
                  className="mq-input"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={t("seller.inventoryPage.unitCost")}
                  aria-label={t("seller.inventoryPage.unitCost")}
                  value={line.unitCost}
                  onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                />
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="mq-icon-btn text-mq-text-muted"
                    aria-label={t("seller.inventoryPage.removeLine")}
                    onClick={() =>
                      setLines((prev) => prev.filter((l) => l.key !== line.key))
                    }
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>

          {formError ? (
            <p className="w-full text-xs text-mq-text-muted">{formError}</p>
          ) : null}
          <button className="mq-btn mq-btn-primary w-full sm:w-auto" disabled={createSlip.isPending}>
            {createSlip.isPending ? t("admin.common.working") : t("seller.inventoryPage.createSlip")}
          </button>
        </form>
      ) : null}

      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      )}
      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("seller.inventoryPage.noSlips")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.code")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.promotions.type")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.items")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.common.status")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.warehouses")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.created")}</th>
                  <th className="py-2 font-medium">{t("seller.common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s: InventorySlip) => (
                  <Fragment key={s.id}>
                  <tr className="border-b border-mq-border/60 align-top">
                    <td className="py-2.5 pr-3 font-medium font-mono text-xs">
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline text-left"
                        onClick={() =>
                          setDetailId((id) => (id === s.id ? null : s.id))
                        }
                      >
                        {s.code}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{slipTypeLabel(s.type, t)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{slipItemsSummary(s)}</span>
                      {(s.items?.length ?? 0) > 1 ? (
                        <ul className="mt-1 text-xs text-mq-text-muted space-y-0.5">
                          {s.items.map((it) => (
                            <li key={it.id}>
                              {it.sku} ×{it.quantity}
                              {it.unitCost != null ? ` @ ${formatMoney(it.unitCost)}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : s.items?.[0]?.unitCost != null ? (
                        <span className="block text-xs text-mq-text-muted mt-0.5">
                          @ {formatMoney(s.items[0].unitCost)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={slipStatusBadge(s.status)}>{translateStatus(t, "inventorySlip", s.status)}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-mq-text-secondary">
                      {s.warehouseCode || "—"}
                      {s.locationNote ? (
                        <span className="block text-xs text-mq-text-muted mt-0.5">
                          {s.locationNote}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-mq-text-muted">
                      {formatDate(s.createdAt)}
                      {s.processedAt ? (
                        <span className="block">
                          {t("seller.inventoryPage.processed", {
                            date: formatDate(s.processedAt),
                          })}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5">
                      {s.status === "PENDING" ? (
                        <AdminActions>
                          <AdminIconButton
                            label={t("seller.common.approve")}
                            icon={Check}
                            tone="approve"
                            disabled={busy}
                            onClick={() => void approveSlip.mutateAsync(s.id)}
                          />
                          <AdminIconButton
                            label={t("seller.common.reject")}
                            icon={X}
                            tone="reject"
                            disabled={busy}
                            onClick={() => setRejectSlipId(s.id)}
                          />
                        </AdminActions>
                      ) : (
                        <span className="text-xs text-mq-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                  {detailId === s.id ? (
                    <tr className="border-b border-mq-border/60">
                      <td colSpan={7} className="pb-3 pt-0">
                        <SlipDetailBody
                          slip={detailQuery.data}
                          loading={detailQuery.isLoading}
                          error={
                            detailQuery.isError
                              ? getErrorMessage(detailQuery.error, t("admin.common.failed"))
                              : null
                          }
                        />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} meta={meta} onPageChange={setPage} />
        </>
      )}
      <ConfirmDialog
        open={Boolean(rejectSlipId)}
        title={t("confirm.rejectSlipTitle")}
        description={t("confirm.rejectSlipDesc")}
        confirmLabel={t("confirm.rejectSlipBtn")}
        tone="danger"
        busy={rejectSlip.isPending}
        onClose={() => setRejectSlipId(null)}
        onConfirm={async () => {
          if (!rejectSlipId) return;
          await rejectSlip.mutateAsync(rejectSlipId);
          setRejectSlipId(null);
        }}
      />
    </div>
  );
}

function LedgerTab() {
  const { t } = useLanguage();
  const [sku, setSku] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data: warehouses = [] } = useWarehouses();
  const warehouseMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) map.set(w.id, w.code);
    return map;
  }, [warehouses]);

  const { data, isLoading, isError, error } = useInventoryLedger({
    sku: sku || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        {t("seller.inventoryPage.ledgerDescBefore")}{" "}
        <code>quantityAfter</code>{" "}
        {t("seller.inventoryPage.ledgerDescAfter")}
      </p>

      <div className="flex flex-wrap gap-3">
        <input
          className="mq-input max-w-[10rem]"
          placeholder={t("seller.inventoryPage.skuFilter")}
          value={sku}
          onChange={(e) => {
            setSku(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="mq-input max-w-[11rem]"
          type="date"
          aria-label={t("seller.inventoryPage.fromDate")}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="mq-input max-w-[11rem]"
          type="date"
          aria-label={t("seller.inventoryPage.toDate")}
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      )}
      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("seller.common.empty")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">{t("admin.common.when")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.warehouseName")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.productsPage.sku")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.promotions.type")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.qty")}</th>
                  <th className="py-2 pr-3 font-medium">{t("seller.inventoryPage.beforeAfter")}</th>
                  <th className="py-2 font-medium">{t("seller.inventoryPage.slips")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row: StockLedgerEntry) => (
                  <tr key={row.id} className="border-b border-mq-border/60">
                    <td className="py-2.5 pr-3 text-xs text-mq-text-muted">
                      {formatDate(row.recordedAt)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs font-medium">
                      {warehouseMap.get(row.warehouseId) || row.warehouseId?.slice(0, 8) || "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{row.sku}</td>
                    <td className="py-2.5 pr-3 text-xs">{slipTypeLabel(row.type, t)}</td>
                    <td className="py-2.5 pr-3">{row.quantity}</td>
                    <td className="py-2.5 pr-3">
                      {row.quantityBefore} → {row.quantityAfter}
                    </td>
                    <td className="py-2.5 text-xs text-mq-text-muted font-mono">
                      {row.slipId.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function InventoryInner() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const slipId = searchParams.get("slipId");
  const tabParam = searchParams.get("tab");
  // Default to the first tab (Warehouses) so the "Inventory" nav item lands on
  // warehouses, not slips. Notifications override this via `?tab=`.
  const [tab, setTab] = useState<TabId>(() =>
    isTabId(tabParam) ? tabParam : slipId ? "slips" : "warehouses",
  );

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap gap-1 border-b border-mq-border pb-px"
        role="tablist"
        aria-label={t("seller.titles.inventory")}
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`px-3.5 py-2 text-sm font-medium rounded-t-md transition-colors ${
                active
                  ? "bg-mq-surface text-mq-text border border-mq-border border-b-mq-surface -mb-px"
                  : "text-mq-text-muted hover:text-mq-text"
              }`}
              onClick={() => setTab(item.id)}
            >
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        <div hidden={tab !== "warehouses"}>
          <WarehousesTab />
        </div>
        <div hidden={tab !== "transfers"}>
          <TransfersTab />
        </div>
        <div hidden={tab !== "variants"}>
          <VariantsTab />
        </div>
        <div hidden={tab !== "slips"}>
          <SlipsTab
            onGoToWarehouses={() => setTab("warehouses")}
            initialSlipId={slipId}
          />
        </div>
        <div hidden={tab !== "ledger"}>
          <LedgerTab />
        </div>
      </div>
    </div>
  );
}

export default function SellerInventoryPage() {
  return (
    <AuthGuard roles={["SELLER", "WAREHOUSE"]}>
      {/* useSearchParams (slip deep-link) needs a Suspense boundary. */}
      <Suspense fallback={<TableSkeleton rows={5} cols={6} />}>
        <InventoryInner />
      </Suspense>
    </AuthGuard>
  );
}
