"use client";

import { FormEvent, useMemo, useState } from "react";
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
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [sku, setSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [isEnrollmentPackage, setIsEnrollmentPackage] = useState(false);

  const { data, isLoading, isError, error } = useInventoryVariants({
    q: q || undefined,
    page,
    pageSize: 20,
  });
  const createVariant = useCreateVariant();
  const items = data?.items ?? [];
  const meta = data?.meta;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = sku.trim();
    if (!trimmed) return;
    const price = unitPrice.trim() === "" ? undefined : Number(unitPrice);
    await createVariant.mutateAsync({
      sku: trimmed,
      availableStock: 0,
      unitPrice: price != null && !Number.isNaN(price) ? price : undefined,
      isEnrollmentPackage,
    });
    setSku("");
    setUnitPrice("");
    setIsEnrollmentPackage(false);
    setShowForm(false);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        SKUs are the source of truth for stock. Stock only changes when a slip is{" "}
        <strong>approved</strong> — create with 0 and use IN slips to receive goods.
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
            placeholder="Unit cost (optional)"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
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
        <TableSkeleton rows={5} cols={4} />
      ) : items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">No SKUs yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mq-text-muted border-b border-mq-border">
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 font-medium">Available</th>
                  <th className="py-2 pr-3 font-medium">Unit cost</th>
                  <th className="py-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {items.map((v: InventoryVariant) => (
                  <tr key={v.id} className="border-b border-mq-border/60">
                    <td className="py-2.5 pr-3 font-medium">{v.sku}</td>
                    <td className="py-2.5 pr-3">{v.availableStock}</td>
                    <td className="py-2.5 pr-3 text-mq-text-secondary">
                      {v.unitPrice != null ? formatMoney(v.unitPrice) : "—"}
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

function SlipsTab() {
  const [status, setStatus] = useState<InventorySlipStatus | "">("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    sku: "",
    quantity: "1",
    type: "IN" as InventorySlipType,
    warehouseCode: "",
    locationNote: "",
  });

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await createSlip.mutateAsync({
      sku: form.sku.trim(),
      quantity: Number(form.quantity),
      type: form.type,
      warehouseCode: form.warehouseCode || undefined,
      locationNote: form.locationNote.trim() || undefined,
    });
    setForm({
      sku: "",
      quantity: "1",
      type: "IN",
      warehouseCode: "",
      locationNote: "",
    });
    setShowForm(false);
    setStatus("PENDING");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">
        Slips are stock-change requests. Creating a slip does not change stock until you approve it.
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
        <form className="mq-card p-4 grid sm:grid-cols-2 gap-3" onSubmit={(e) => void onSubmit(e)}>
          <select
            className="mq-input"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
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
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            required
          />
          <select
            className="mq-input"
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as InventorySlipType })
            }
          >
            <option value="IN">IN — goods received</option>
            <option value="ADJUST_IN">ADJUST_IN — increase</option>
            <option value="ADJUST_OUT">ADJUST_OUT — write-off</option>
          </select>
          <select
            className="mq-input"
            value={form.warehouseCode}
            onChange={(e) => setForm({ ...form, warehouseCode: e.target.value })}
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
            value={form.locationNote}
            maxLength={300}
            onChange={(e) => setForm({ ...form, locationNote: e.target.value })}
          />
          <button className="mq-btn mq-btn-primary sm:col-span-2" disabled={createSlip.isPending}>
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
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Warehouse</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s: InventorySlip) => (
                  <tr key={s.id} className="border-b border-mq-border/60 align-top">
                    <td className="py-2.5 pr-3 font-medium">{s.sku}</td>
                    <td className="py-2.5 pr-3 text-xs">{slipTypeLabel(s.type)}</td>
                    <td className="py-2.5 pr-3">{s.quantity}</td>
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
        Immutable history. Each approved slip writes one ledger row. Use{" "}
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
    <AuthGuard roles={["SELLER"]}>
      <InventoryInner />
    </AuthGuard>
  );
}
