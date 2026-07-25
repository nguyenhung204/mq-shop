"use client";

import { use } from "react";
import { WalletWithdrawalDetail } from "@/components/wallet/WalletWithdrawalDetail";

export default function BuyerWalletWithdrawalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <WalletWithdrawalDetail payoutId={id} />;
}
