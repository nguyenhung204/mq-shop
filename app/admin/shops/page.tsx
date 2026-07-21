"use client";

import { useState } from "react";
import { Check, Eye, ShieldAlert, X } from "lucide-react";
import {
  useAdminShops,
  useApproveShop,
  useRejectShop,
  useSuspendShop,
} from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  AdminActions,
  AdminIconButton,
  AdminIconLink,
} from "@/components/admin/AdminIconButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function ShopsInner() {
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [reason, setReason] = useState("Thiếu giấy tờ");
  const { data, isLoading, isError, error } = useAdminShops(status, page);
  const shops = data?.items ?? [];
  const meta = data?.meta;
  const approveShop = useApproveShop();
  const rejectShop = useRejectShop();
  const suspendShop = useSuspendShop();

  return (
    <>
      <AdminPageHeader
        title="Shops"
        description="Review seller applications and violation locks."
      />
      <div className="space-y-4">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <select
            className="mq-input max-w-xs"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {["PENDING", "APPROVED", "REJECTED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className="mq-input max-w-md"
            placeholder="Reject/violation reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 150))}
          />
        </div>
        {isLoading && <AdminCardListSkeleton />}
        {shops.map((s) => (
          <div key={s.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-mq-text-muted text-xs">
                {s.taxId || s.taxCode} · {s.countryCode} · {s.status}
              </p>
            </div>
            <AdminActions>
              <AdminIconLink href={`/admin/shops/${s.id}`} label="View details" icon={Eye} />
              <AdminIconButton
                label="Approve"
                icon={Check}
                tone="approve"
                disabled={approveShop.isPending}
                onClick={() => void approveShop.mutateAsync(s.id)}
              />
              <AdminIconButton
                label="Reject"
                icon={X}
                tone="reject"
                disabled={rejectShop.isPending}
                onClick={() => void rejectShop.mutateAsync({ id: s.id, reason })}
              />
              <AdminIconButton
                label="Violation lock"
                icon={ShieldAlert}
                tone="warn"
                disabled={suspendShop.isPending}
                onClick={() => void suspendShop.mutateAsync({ id: s.id, reason })}
              />
            </AdminActions>
          </div>
        ))}
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>
    </>
  );
}

export default function AdminShopsPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["APPROVE_SELLER", "APPROVE_SHOP"]}
    >
      <ShopsInner />
    </AuthGuard>
  );
}
