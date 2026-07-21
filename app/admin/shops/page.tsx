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
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

type ReasonAction = {
  kind: "reject" | "violation";
  shopId: string;
  shopName: string;
};

function ShopsInner() {
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const { data, isLoading, isError, error } = useAdminShops(status, page);
  const shops = data?.items ?? [];
  const meta = data?.meta;
  const approveShop = useApproveShop();
  const rejectShop = useRejectShop();
  const suspendShop = useSuspendShop();

  const modalBusy =
    reasonAction?.kind === "reject" ? rejectShop.isPending : suspendShop.isPending;

  return (
    <>
      <AdminPageHeader
        title="Shops"
        description="Review seller applications and violation locks."
        actions={
          <select
            className="mq-input max-w-[11rem]"
            value={status}
            aria-label="Filter by status"
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
        }
      />

      <div className="space-y-4">
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}
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
                disabled={approveShop.isPending || s.status !== "PENDING"}
                onClick={() => void approveShop.mutateAsync(s.id)}
              />
              <AdminIconButton
                label="Reject"
                icon={X}
                tone="reject"
                disabled={rejectShop.isPending || s.status !== "PENDING"}
                onClick={() =>
                  setReasonAction({ kind: "reject", shopId: s.id, shopName: s.name })
                }
              />
              <AdminIconButton
                label="Violation lock"
                icon={ShieldAlert}
                tone="warn"
                disabled={suspendShop.isPending || s.status !== "APPROVED"}
                onClick={() =>
                  setReasonAction({ kind: "violation", shopId: s.id, shopName: s.name })
                }
              />
            </AdminActions>
          </div>
        ))}
        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>

      <AdminReasonModal
        open={!!reasonAction}
        title={reasonAction?.kind === "reject" ? "Reject shop" : "Violation lock"}
        description={
          reasonAction
            ? reasonAction.kind === "reject"
              ? `Tell the seller why “${reasonAction.shopName}” was rejected.`
              : `Optional note for locking “${reasonAction.shopName}”.`
            : undefined
        }
        confirmLabel={reasonAction?.kind === "reject" ? "Reject" : "Lock shop"}
        required={reasonAction?.kind === "reject"}
        busy={modalBusy}
        onClose={() => {
          if (!modalBusy) setReasonAction(null);
        }}
        onConfirm={async (reason) => {
          if (!reasonAction) return;
          if (reasonAction.kind === "reject") {
            await rejectShop.mutateAsync({ id: reasonAction.shopId, reason });
          } else {
            await suspendShop.mutateAsync({
              id: reasonAction.shopId,
              reason: reason || undefined,
            });
          }
          setReasonAction(null);
        }}
      />
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
