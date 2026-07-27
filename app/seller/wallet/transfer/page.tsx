"use client";

import { WalletP2p } from "@/components/wallet/WalletP2p";

export default function SellerWalletTransferPage() {
  return <WalletP2p embedded walletHref="/seller/wallet" />;
}
