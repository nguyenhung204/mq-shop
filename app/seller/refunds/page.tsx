"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { PartyCaseList } from "@/components/refund-cases/PartyCaseList";
import { useSellerRefundCases } from "@/lib/queries/refund-cases";

function SellerRefundsInner() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const list = useSellerRefundCases(status, page);
  return <PartyCaseList side="seller" list={list} status={status} onStatusChange={setStatus} page={page} onPageChange={setPage} />;
}

export default function SellerRefundsPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <SellerRefundsInner />
    </AuthGuard>
  );
}
