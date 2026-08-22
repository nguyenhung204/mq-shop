"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Check, Play, X } from "lucide-react";
import type { PayoutRequestStatus } from "@/lib/api/wallet";
import {
  useAdminWalletPayout,
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
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { WalletPayoutDetailFields } from "@/components/wallet/walletPayoutUi";
import { getErrorMessage } from "@/lib/queries/utils";

function WalletPayoutDetailInner({ payoutId }: { payoutId: string }) {
  const { t } = useLanguage();
  const { canMutatePermission } = useAuth();
  const canApproveWallet = canMutatePermission("APPROVE_PAYOUT");
  const canProcess = canMutatePermission("PROCESS_PAYOUT");

  const { data: payout, isLoading, isError, error } = useAdminWalletPayout(payoutId);
  const approve = useApproveWalletPayout();
  const reject = useRejectWalletPayout();
  const process = useProcessWalletPayout();
  const [rejectOpen, setRejectOpen] = useState(false);

  const labels = {
    status: (s: PayoutRequestStatus) => t(`wallet.payoutStatus.${s}`),
    bankName: t("wallet.bankName"),
    accountNumber: t("wallet.accountNumber"),
    accountName: t("wallet.accountName"),
    reason: t("admin.common.reason"),
    gatewayRef: t("admin.walletPayouts.gatewayRef"),
    createdAt: t("admin.walletPayouts.createdAt"),
    updatedAt: t("admin.walletPayouts.updatedAt"),
    fiatLabel: t("wallet.fiatLabel"),
    pointUnit: t("common.pointUnit"),
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.walletPayouts.detailTitle")}
        description={t("admin.walletPayouts.detailDescription")}
        actions={
          <Link
            href="/admin/wallet/payouts"
            className="mq-admin-btn mq-admin-btn-secondary"
          >
            <ArrowLeft size={16} aria-hidden />
            {t("admin.walletPayouts.backToList")}
          </Link>
        }
      />

      <div className="space-y-5 max-w-2xl">
        {isLoading ? <AdminCardListSkeleton count={2} /> : null}
        {isError ? (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        ) : null}

        {payout ? (
          <WalletPayoutDetailFields
            payout={payout}
            labels={labels}
            actions={
              payout.status === "PENDING" && canApproveWallet ? (
                <AdminActions>
                  <AdminIconButton
                    label={t("admin.common.approve")}
                    icon={Check}
                    tone="approve"
                    disabled={approve.isPending}
                    onClick={() => void approve.mutateAsync(payout.id)}
                  />
                  <AdminIconButton
                    label={t("admin.common.reject")}
                    icon={X}
                    tone="reject"
                    disabled={reject.isPending}
                    onClick={() => setRejectOpen(true)}
                  />
                </AdminActions>
              ) : payout.status === "APPROVED" && canProcess ? (
                <div className="flex flex-wrap items-center justify-end gap-3 w-full">
                  <p className="text-sm text-mq-text-muted mr-auto">
                    {t("admin.walletPayouts.processHint")}
                  </p>
                  <AdminActions>
                    <AdminIconButton
                      label={t("admin.walletPayouts.process")}
                      icon={Play}
                      tone="secondary"
                      disabled={process.isPending}
                      onClick={() => void process.mutateAsync(payout.id)}
                    />
                  </AdminActions>
                </div>
              ) : undefined
            }
          />
        ) : null}
      </div>

      <AdminReasonModal
        open={rejectOpen}
        title={t("admin.walletPayouts.rejectTitle")}
        confirmLabel={t("admin.common.reject")}
        maxLength={500}
        busy={reject.isPending}
        onClose={() => setRejectOpen(false)}
        onConfirm={async (reason) => {
          await reject.mutateAsync({ id: payoutId, reason });
          setRejectOpen(false);
        }}
      />
    </>
  );
}

function AdminWalletPayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard
      roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]}
      permissions={["APPROVE_PAYOUT"]}
    >
      <WalletPayoutDetailInner payoutId={id} />
    </AuthGuard>
  );
}

export default AdminWalletPayoutDetailPage;
