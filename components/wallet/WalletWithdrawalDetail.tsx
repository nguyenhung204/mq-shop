"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { PayoutRequestStatus } from "@/lib/api/wallet";
import { useWalletWithdrawal } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { WalletPayoutDetailFields } from "@/components/wallet/walletPayoutUi";
import { getErrorMessage } from "@/lib/queries/utils";

function WithdrawalDetailInner({
  payoutId,
  listHref,
  walletHref,
  embedded = false,
}: {
  payoutId: string;
  listHref: string;
  walletHref: string;
  embedded?: boolean;
}) {
  const { t } = useLanguage();
  const { data: payout, isLoading, isError, error } = useWalletWithdrawal(payoutId);

  const labels = {
    status: (s: PayoutRequestStatus) => t(`wallet.payoutStatus.${s}`),
    bankName: t("wallet.bankName"),
    accountNumber: t("wallet.accountNumber"),
    accountName: t("wallet.accountName"),
    reason: t("wallet.withdrawRejectionReason"),
    gatewayRef: t("wallet.withdrawGatewayRef"),
    createdAt: t("wallet.withdrawCreatedAt"),
    updatedAt: t("wallet.withdrawUpdatedAt"),
  };

  const body = (
    <div className={embedded ? "space-y-4 max-w-lg" : "space-y-4"}>
      <Link href={listHref} className="mq-btn mq-btn-outline inline-flex items-center gap-2">
        <ArrowLeft size={16} aria-hidden />
        {t("wallet.withdrawBackToList")}
      </Link>

      {isLoading ? <AdminCardListSkeleton count={2} /> : null}
      {isError ? (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("wallet.loadFailed"))}
        </div>
      ) : null}
      {payout ? <WalletPayoutDetailFields payout={payout} labels={labels} /> : null}
    </div>
  );

  if (embedded) return body;

  return (
    <>
      <PageHero
        title={t("wallet.withdrawDetail")}
        breadcrumb={[
          { label: t("wallet.title"), href: walletHref },
          { label: t("wallet.withdraw"), href: listHref },
          { label: t("wallet.withdrawDetail") },
        ]}
      />
      <Container className="py-10 max-w-lg mx-auto">{body}</Container>
    </>
  );
}

export function WalletWithdrawalDetail({
  payoutId,
  listHref = "/wallet/withdraw",
  walletHref = "/wallet",
  embedded = false,
}: {
  payoutId: string;
  listHref?: string;
  walletHref?: string;
  embedded?: boolean;
}) {
  return (
    <AuthGuard
      roles={["BUYER", "SELLER", "SUPER_ADMIN"]}
      permissions={["VIEW_WALLET"]}
    >
      <WithdrawalDetailInner
        payoutId={payoutId}
        listHref={listHref}
        walletHref={walletHref}
        embedded={embedded}
      />
    </AuthGuard>
  );
}
