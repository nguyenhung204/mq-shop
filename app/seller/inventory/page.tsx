"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type {
  InventorySlip,
  InventorySlipStatus,
  InventorySlipType,
  InventoryVariant,
  StockLedgerEntry,
  Warehouse,
} from "@/lib/api/inventory";
import { formatMoney } from "@/lib/api/utils";
import {
  useApproveSlip,
  useCreateSlip,
  useCreateVariant,
  useCreateWarehouse,
  useInventoryLedger,
  useInventorySlips,
  useInventoryVariants,
  useRejectSlip,
  useWarehouses,
} from "@/lib/queries/inventory";
import { useSellerProducts } from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import {
  AdminActions,
  AdminIconButton,
} from "@/components/admin/AdminIconButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";

type TabId = "warehouses" | "variants" | "slips" | "ledger";

const TABS: { id: TabId; label: string }[] = [
  { id: "warehouses", label: "Warehouses" },
  { id: "variants", label: "Variants" },
  { id: "slips", label: "Slips" },
  { id: "ledger", label: "Ledger" },
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

function slipTypeLabel(type: InventorySlipType): string {
  switch (type) {
    case "IN":
      return "IN (+)";
    case "ADJUST_IN":
      return "ADJUST IN (+)";
    case "ADJUST_OUT":
      return "ADJUST OUT (−)";
    default:
      return type;
  }
}

function WarehousesTab() {
  const { data: warehouses = [], isLoading, isError, error } = useWarehouses();
  const createWarehouse = useCreateWarehouse();
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [formError, setFormError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || trimmed.length > 32 || !WH_CODE_RE.test(trimmed)) {
      setFormError("Code: letters, numbers, _ or - (max 32).");
      return;
    }
    setFormError("");
    await createWarehouse.mutateAsync({
      code: trimmed,
      address: address.trim() || undefined,
    });
    setCode("");
    setAddress("");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        Locations for receiving stock. Use codes like <code>KHO-HN</code> on slips.
      </p>
      <form className="mq-card p-4 flex flex-wrap gap-3" onSubmit={(e) => void onSubmit(e)}>
        <input
          className="mq-input flex-1 min-w-[140px]"
          placeholder="Code (e.g. KHO-HN)"
          value={code}
          maxLength={32}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
        />
        <input
          className="mq-input flex-[2] min-w-[200px]"
          placeholder="Address (optional)"
          value={address}
          maxLength={200}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button className="mq-btn mq-btn-primary" disabled={createWarehouse.isPending}>
          {createWarehouse.isPending ? "Adding…" : "Add warehouse"}
        </button>
        {formError ? (
          <p className="w-full text-xs text-mq-text-muted">{formError}</p>
        ) : null}
      </form>

      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed to load warehouses"}
        </div>
      )}
      {isLoading ? (
        <TableSkeleton rows={3} cols={3} />
      ) : warehouses.length === 0 ? (
        <p className="text-sm text-mq-text-muted">No warehouses yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mq-text-muted border-b border-mq-border">
                <th className="py-2 pr-3 font-medium">Code</th>
                <th className="py-2 pr-3 font-medium">Address</th>
                <th className="py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w: Warehouse) => (
                <tr key={w.id} className="border-b border-mq-border/60">
                  <td className="py-2.5 pr-3 font-medium">{w.code}</td>
                  <td className="py-2.5 pr-3 text-mq-text-secondary">{w.address || "—"}</td>
                  <td className="py-2.5 text-mq-text-muted text-xs">
                    {formatDate(w.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VariantsTab() {
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
    await createVariant.mutateAsync({
      productId,
      sku: trimmedSku,
      sellingPrice: sell,
      options,
      isEnrollmentPackage,
    });
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
        Prefer adding SKUs on the{" "}
        <Link href="/seller/products" className="underline">
          Products
        </Link>{" "}
        form. This shortcut still needs a product + sell price. Stock starts at 0 — use slips to
        receive goods.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="mq-input max-w-xs"
          placeholder="Search SKU…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="mq-input max-w-[14rem]"
          value={productFilter}
          aria-label="Filter by product"
          onChange={(e) => {
            setProductFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All products</option>
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
          {showForm ? "Cancel" : "Add SKU"}
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
            <option value="">Select product</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || p.name || p.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <input
            className="mq-input"
            placeholder="SKU (e.g. MOUSE-001)"
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
            placeholder="Sell price"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            required
          />
          <input
            className="mq-input sm:col-span-2"
            placeholder="Options (optional) — size=M, color=black"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isEnrollmentPackage}
              onChange={(e) => setIsEnrollmentPackage(e.target.checked)}
            />
            Enrollment package (MLM)
          </label>
          <button className="mq-btn mq-btn-primary sm:col-span-2" disabled={createVariant.isPending}>
            {createVariant.isPending ? "Creating…" : "Create SKU"}
          </button>
        </form>
      ) : null}

      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed to load variants"}
        </div>
      )}
      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">No SKUs yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 pr-3 font-medium">Sell price</th>
                  <th className="py-2 pr-3 font-medium">Available</th>
                  <th className="py-2 pr-3 font-medium">Cost price</th>
                  <th className="py-2 font-medium">Flags</th>
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
                    <td className="py-2.5 pr-3">{v.availableStock}</td>
                    <td className="py-2.5 pr-3 text-mq-text-secondary">
                      {v.costPrice != null ? formatMoney(v.costPrice) : "—"}
                    </td>
                    <td className="py-2.5 text-xs text-mq-text-muted">
                      {v.isEnrollmentPackage ? "Enrollment pkg" : "—"}
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

function SlipsTab() {
  const [status, setStatus] = useState<InventorySlipStatus | "">("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [type, setType] = useState<InventorySlipType>("IN");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [lines, setLines] = useState(() => [emptySlipLine()]);

  const { data: warehouses = [] } = useWarehouses();
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
  const createSlip = useCreateSlip();
  const approveSlip = useApproveSlip();
  const rejectSlip = useRejectSlip();
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
    const skus = lines.map((l) => l.sku.trim()).filter(Boolean);
    if (!skus.length) {
      setFormError("Add at least one SKU line.");
      return;
    }
    if (new Set(skus).size !== skus.length) {
      setFormError("Duplicate SKU in slip items — each SKU can appear only once.");
      return;
    }
    const payloadItems = [];
    for (const line of lines) {
      const sku = line.sku.trim();
      if (!sku) continue;
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setFormError(`Invalid quantity for SKU “${sku}”.`);
        return;
      }
      const costRaw = line.unitCost.trim();
      const unitCost = costRaw === "" ? undefined : Number(costRaw);
      if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
        setFormError(`Invalid unit cost for SKU “${sku}”.`);
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
        warehouseCode: warehouseCode || undefined,
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
      <p className="text-sm text-mq-text-muted">
        Slips are multi-SKU stock-change requests. Creating a slip does not change stock until you
        approve it.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="mq-input max-w-[11rem]"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as InventorySlipStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button
          type="button"
          className="mq-btn mq-btn-primary ml-auto"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "New slip"}
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
              <option value="IN">IN — goods received</option>
              <option value="ADJUST_IN">ADJUST_IN — increase</option>
              <option value="ADJUST_OUT">ADJUST_OUT — write-off</option>
            </select>
            <select
              className="mq-input"
              value={warehouseCode}
              onChange={(e) => setWarehouseCode(e.target.value)}
            >
              <option value="">Warehouse (optional)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.code}>
                  {w.code}
                </option>
              ))}
            </select>
            <input
              className="mq-input sm:col-span-2"
              placeholder="Location note (optional)"
              value={locationNote}
              maxLength={300}
              onChange={(e) => setLocationNote(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Items</h3>
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                onClick={() => setLines((prev) => [...prev, emptySlipLine()])}
              >
                Add line
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
                  <option value="">Select SKU</option>
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
                  aria-label="Quantity"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                  required
                />
                <input
                  className="mq-input"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Unit cost"
                  aria-label="Unit cost"
                  value={line.unitCost}
                  onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                />
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="mq-icon-btn text-mq-text-muted"
                    aria-label="Remove line"
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
            {createSlip.isPending ? "Creating…" : "Create slip"}
          </button>
        </form>
      ) : null}

      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed to load slips"}
        </div>
      )}
      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">No slips for this filter.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Items</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Warehouse</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s: InventorySlip) => (
                  <tr key={s.id} className="border-b border-mq-border/60 align-top">
                    <td className="py-2.5 pr-3 font-medium font-mono text-xs">{s.code}</td>
                    <td className="py-2.5 pr-3 text-xs">{slipTypeLabel(s.type)}</td>
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
                      <span className={slipStatusBadge(s.status)}>{s.status}</span>
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
                        <span className="block">Processed {formatDate(s.processedAt)}</span>
                      ) : null}
                    </td>
                    <td className="py-2.5">
                      {s.status === "PENDING" ? (
                        <AdminActions>
                          <AdminIconButton
                            label="Approve"
                            icon={Check}
                            tone="approve"
                            disabled={busy}
                            onClick={() => void approveSlip.mutateAsync(s.id)}
                          />
                          <AdminIconButton
                            label="Reject"
                            icon={X}
                            tone="reject"
                            disabled={busy}
                            onClick={() => void rejectSlip.mutateAsync(s.id)}
                          />
                        </AdminActions>
                      ) : (
                        <span className="text-xs text-mq-text-muted">—</span>
                      )}
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

function LedgerTab() {
  const [sku, setSku] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

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
        Immutable history. Each approved slip writes one ledger row per item. Use{" "}
        <code>quantityAfter</code> as the historical stock figure.
      </p>

      <div className="flex flex-wrap gap-3">
        <input
          className="mq-input max-w-[10rem]"
          placeholder="SKU filter"
          value={sku}
          onChange={(e) => {
            setSku(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="mq-input max-w-[11rem]"
          type="date"
          aria-label="From date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="mq-input max-w-[11rem]"
          type="date"
          aria-label="To date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isError && (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed to load ledger"}
        </div>
      )}
      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">No ledger entries yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Before → After</th>
                  <th className="py-2 font-medium">Slip</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row: StockLedgerEntry) => (
                  <tr key={row.id} className="border-b border-mq-border/60">
                    <td className="py-2.5 pr-3 text-xs text-mq-text-muted">
                      {formatDate(row.recordedAt)}
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{row.sku}</td>
                    <td className="py-2.5 pr-3 text-xs">{slipTypeLabel(row.type)}</td>
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

function InventoryInner() {
  const [tab, setTab] = useState<TabId>("slips");

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap gap-1 border-b border-mq-border pb-px"
        role="tablist"
        aria-label="Inventory sections"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`px-3.5 py-2 text-sm font-medium rounded-t-md transition-colors ${
                active
                  ? "bg-mq-surface text-mq-text border border-mq-border border-b-mq-surface -mb-px"
                  : "text-mq-text-muted hover:text-mq-text"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        <div hidden={tab !== "warehouses"}>
          <WarehousesTab />
        </div>
        <div hidden={tab !== "variants"}>
          <VariantsTab />
        </div>
        <div hidden={tab !== "slips"}>
          <SlipsTab />
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
      <InventoryInner />
    </AuthGuard>
  );
}
