"use client";

import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AuthGuard } from "@/components/guards/AuthGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "CS"]}>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
