"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Play, X } from "lucide-react";
import type { PayoutRequestStatus } from "@/lib/api/wallet";
import { formatMoney } from "@/lib/api/utils";
import {
  useAdminWalletPayouts,
  useApproveWalletPayout,
  useProcessWalletPayout,
  useRejectWalletPayout,
} from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

const STATUSES: Array<PayoutRequestStatus | ""> = [
  "",
  "PENDING",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "PAY_FAILED",
];

function statusBadgeClass(status: PayoutRequestStatus): string {
  switch (status) {
    case "PENDING":
      return "mq-badge mq-badge-cyan";
    case "APPROVED":
      return "mq-badge mq-badge-teal";
    case "COMPLETED":
      return "mq-badge mq-badge-muted";
    case "REJECTED":
    case "PAY_FAILED":
      return "mq-badge mq-badge-pink";
    default:
      return "mq-badge mq-badge-muted";
  }
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function WalletPayoutsInner() {
  const { t } = useLanguage();
  const { hasPermission, hasRole } = useAuth();
  const canProcess =
    hasPermission("PROCESS_PAYOUT") ||
    hasRole("ACCOUNTANT") ||
    hasRole("SUPER_ADMIN");

  const [status, setStatus] = useState<PayoutRequestStatus | "">("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const [rejectId, setRejectId] = useState<string | null>(null);

  const { data, isLoading, isError, error, isFetching } = useAdminWalletPayouts({
    status: status || undefined,
    userId: userId.trim() || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  const approve = useApproveWalletPayout();
  const reject = useRejectWalletPayout();
  const process = useProcessWalletPayout();

  return (
    <>
      <AdminPageHeader
        title={t("admin.walletPayouts.title")}
        description={t("admin.walletPayouts.description")}
      />

      <div className="space-y-4">
        <p className="text-sm text-mq-text-muted">{t("admin.walletPayouts.hint")}</p>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-mq-text-muted text-xs">{t("admin.common.filterStatus")}</span>
            <select
              className="mq-input !w-[11rem] max-w-full"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as PayoutRequestStatus | "");
                setPage(1);
              }}
            >
              <option value="">{t("admin.common.allStatuses")}</option>
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {t(`wallet.payoutStatus.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-mq-text-muted text-xs">{t("admin.walletPayouts.userId")}</span>
            <input
              className="mq-input min-w-[14rem]"
              value={userId}
              placeholder="uuid"
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        {isError ? (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        ) : null}

        {(isLoading || isFetching) && items.length === 0 ? (
          <AdminCardListSkeleton count={5} />
        ) : null}

        {!isLoading && items.length === 0 && !isError ? (
          <p className="text-sm text-mq-text-muted py-6 text-center">
            {t("admin.walletPayouts.empty")}
          </p>
        ) : null}

        {items.map((row) => (
          <div
            key={row.id}
            className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
          >
            <Link
              href={`/admin/wallet/payouts/${row.id}`}
              className="space-y-1 min-w-0 flex-1 hover:opacity-90"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusBadgeClass(row.status)}>
                  {t(`wallet.payoutStatus.${row.status}`)}
                </span>
                <span className="tabular-nums font-medium">{formatMoney(row.amount)}</span>
              </div>
              <p className="text-xs text-mq-text-muted font-mono truncate">
                {row.id} · user {row.userId.slice(0, 8)}…
              </p>
              <p className="text-xs text-mq-text-muted">{formatWhen(row.createdAt)}</p>
              {row.bankInfo ? (
                <p className="text-xs text-mq-text-muted">
                  {row.bankInfo.bankName} · {row.bankInfo.accountNumber} ·{" "}
                  {row.bankInfo.accountName}
                </p>
              ) : null}
              {row.rejectionReason ? (
                <p className="text-xs text-mq-text-muted">
                  {t("admin.common.reason")}: {row.rejectionReason}
                </p>
              ) : null}
              <p className="text-xs text-mq-accent mt-1">{t("admin.walletPayouts.viewDetail")}</p>
            </Link>
            <AdminActions>
              {row.status === "PENDING" ? (
                <>
                  <AdminIconButton
                    label={t("admin.common.approve")}
                    icon={Check}
                    tone="approve"
                    onClick={() => void approve.mutateAsync(row.id)}
                    disabled={approve.isPending}
                  />
                  <AdminIconButton
                    label={t("admin.common.reject")}
                    icon={X}
                    tone="reject"
                    onClick={() => setRejectId(row.id)}
                    disabled={reject.isPending}
                  />
                </>
              ) : null}
              {row.status === "APPROVED" && canProcess ? (
                <AdminIconButton
                  label={t("admin.walletPayouts.process")}
                  icon={Play}
                  tone="secondary"
                  onClick={() => void process.mutateAsync(row.id)}
                  disabled={process.isPending}
                />
              ) : null}
            </AdminActions>
          </div>
        ))}

        {meta ? <PaginationBar page={page} meta={meta} onPageChange={setPage} /> : null}
      </div>

      <AdminReasonModal
        open={Boolean(rejectId)}
        title={t("admin.walletPayouts.rejectTitle")}
        confirmLabel={t("admin.common.reject")}
        maxLength={500}
        busy={reject.isPending}
        onClose={() => setRejectId(null)}
        onConfirm={async (reason) => {
          if (!rejectId) return;
          await reject.mutateAsync({ id: rejectId, reason });
          setRejectId(null);
        }}
      />
    </>
  );
}

export default function AdminWalletPayoutsPage() {
  return (
    <AuthGuard
      roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]}
      permissions={["APPROVE_PAYOUT"]}
    >
      <WalletPayoutsInner />
    </AuthGuard>
  );
}
