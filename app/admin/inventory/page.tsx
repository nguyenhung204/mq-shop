"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { InventorySlip, InventorySlipStatus } from "@/lib/api/inventory";
import {
  useAdminApproveSlip,
  useAdminInventorySlips,
  useAdminRejectSlip,
} from "@/lib/queries/inventory";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function statusBadge(status: InventorySlipStatus): string {
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

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function InventoryInner() {
  const [status, setStatus] = useState<InventorySlipStatus | "">("PENDING");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useAdminInventorySlips({
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;
  const approveSlip = useAdminApproveSlip();
  const rejectSlip = useAdminRejectSlip();
  const busy = approveSlip.isPending || rejectSlip.isPending;

  return (
    <>
      <AdminPageHeader
        title="Inventory slips"
        description="Cross-shop inbox — approve or reject pending stock changes."
        actions={
          <select
            className="mq-input max-w-[11rem]"
            value={status}
            aria-label="Filter by status"
            onChange={(e) => {
              setStatus(e.target.value as InventorySlipStatus | "");
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        }
      />

      <div className="space-y-4">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        {isLoading ? (
          <AdminCardListSkeleton count={4} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">No slips for this filter.</p>
        ) : (
          items.map((s: InventorySlip) => (
            <div
              key={s.id}
              className="mq-card p-4 flex flex-wrap gap-4 items-start justify-between text-sm"
            >
              <div className="min-w-[200px] flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.sku}</span>
                  <span className={statusBadge(s.status)}>{s.status}</span>
                  <span className="text-xs text-mq-text-muted">{s.type}</span>
                </div>
                <p className="text-mq-text-secondary">
                  Qty {s.quantity}
                  {s.warehouseCode ? ` · ${s.warehouseCode}` : ""}
                </p>
                {s.locationNote ? (
                  <p className="text-xs text-mq-text-muted">{s.locationNote}</p>
                ) : null}
                <p className="text-xs text-mq-text-muted font-mono">
                  Shop {s.shopId.slice(0, 8)}… · Slip {s.id.slice(0, 8)}…
                </p>
                <p className="text-xs text-mq-text-muted">
                  Created {formatWhen(s.createdAt)}
                  {s.processedAt ? ` · Processed ${formatWhen(s.processedAt)}` : ""}
                </p>
              </div>
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
              ) : null}
            </div>
          ))
        )}
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>
    </>
  );
}

export default function AdminInventoryPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["VIEW_INVENTORY", "EDIT_INVENTORY"]}
    >
      <InventoryInner />
    </AuthGuard>
  );
}
