import type { ReactNode } from "react";
import type { PayoutRequestStatus, UserPayoutRequest } from "@/lib/api/wallet";
import { formatPoints } from "@/lib/api/utils";
import { formatDisplayMoney, FX_BASE_CURRENCY } from "@/lib/points";

export function walletPayoutStatusBadgeClass(status: PayoutRequestStatus): string {
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

export function formatWalletPayoutWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type Labels = {
  status: (status: PayoutRequestStatus) => string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  reason?: string;
  gatewayRef?: string;
  createdAt?: string;
  updatedAt?: string;
  fiatLabel?: string;
  /** Optional region approx line under bank TWD. */
  regionApprox?: string | null;
};

/** Read-only payout fields for buyer/admin detail. */
export function WalletPayoutDetailFields({
  payout,
  labels,
  actions,
}: {
  payout: UserPayoutRequest;
  labels: Labels;
  /** Rendered bottom-right inside the card (e.g. approve / reject). */
  actions?: ReactNode;
}) {
  return (
    <div className="mq-card p-5 space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-2xl tabular-nums font-medium">{formatPoints(payout.amount)}</p>
          {payout.fiatAmount ? (
            <div className="text-sm text-mq-text-muted space-y-0.5">
              <p>
                {labels.fiatLabel ? `${labels.fiatLabel}: ` : null}
                {formatDisplayMoney(payout.fiatAmount, FX_BASE_CURRENCY)}
              </p>
              {labels.regionApprox ? (
                <p className="text-xs">{labels.regionApprox}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <span className={walletPayoutStatusBadgeClass(payout.status)}>
          {labels.status(payout.status)}
        </span>
      </div>

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 border-t border-mq-border/60 pt-4">
        {labels.createdAt ? (
          <div>
            <dt className="text-xs text-mq-text-muted">{labels.createdAt}</dt>
            <dd className="mt-0.5">{formatWalletPayoutWhen(payout.createdAt)}</dd>
          </div>
        ) : null}
        {labels.updatedAt && payout.updatedAt ? (
          <div>
            <dt className="text-xs text-mq-text-muted">{labels.updatedAt}</dt>
            <dd className="mt-0.5">{formatWalletPayoutWhen(payout.updatedAt)}</dd>
          </div>
        ) : null}
        {payout.bankInfo ? (
          <>
            <div>
              <dt className="text-xs text-mq-text-muted">{labels.bankName}</dt>
              <dd className="mt-0.5">{payout.bankInfo.bankName}</dd>
            </div>
            <div>
              <dt className="text-xs text-mq-text-muted">{labels.accountNumber}</dt>
              <dd className="mt-0.5 font-mono">{payout.bankInfo.accountNumber}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-mq-text-muted">{labels.accountName}</dt>
              <dd className="mt-0.5">{payout.bankInfo.accountName}</dd>
            </div>
          </>
        ) : null}
        {payout.rejectionReason && labels.reason ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-mq-text-muted">{labels.reason}</dt>
            <dd className="mt-0.5">{payout.rejectionReason}</dd>
          </div>
        ) : null}
      </dl>

      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-mq-border/60 pt-4">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
