"use client";

import { WalletWithdraw } from "@/components/wallet/WalletWithdraw";

export default function SellerWalletWithdrawPage() {
  return <WalletWithdraw embedded walletHref="/seller/wallet" />;
}
