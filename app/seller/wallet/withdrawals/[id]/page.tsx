"use client";

import { use } from "react";
import { WalletWithdrawalDetail } from "@/components/wallet/WalletWithdrawalDetail";

export default function SellerWalletWithdrawalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <WalletWithdrawalDetail
      payoutId={id}
      embedded
      listHref="/seller/wallet/withdraw"
      walletHref="/seller/wallet"
    />
  );
}
