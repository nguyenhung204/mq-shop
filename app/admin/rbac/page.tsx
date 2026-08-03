"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { RbacPermissionMatrix } from "@/components/admin/RbacPermissionMatrix";

export default function AdminRbacMatrixPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN"]} permissions={["CONFIG_SYS"]}>
      <RbacPermissionMatrix />
    </AuthGuard>
  );
}
