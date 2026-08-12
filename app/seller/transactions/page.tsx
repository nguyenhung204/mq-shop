"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { TransactionsReport } from "@/components/finance/TransactionsReport";

export default function SellerTransactionsPage() {
  return (
    <AuthGuard roles={["SELLER"]} permissions={["VIEW_TRANSACT"]}>
      <TransactionsReport view="shop" />
    </AuthGuard>
  );
}
