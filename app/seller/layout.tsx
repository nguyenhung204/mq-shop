"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerShell } from "@/components/seller/SellerShell";

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard roles={["SELLER"]}>
      <SellerShell>{children}</SellerShell>
    </AuthGuard>
  );
}
