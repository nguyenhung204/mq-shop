"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminFxRatesPanel } from "@/components/admin/AdminFxRatesPanel";

/**
 * Standalone FX rates page. The server lets ADMIN edit rates (CONFIG_SYS) but not the fee config
 * page (CONFIG_FEE), so the panel cannot live only inside `/admin/finance/configs`.
 */
export default function AdminFxRatesPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["CONFIG_SYS"]}>
      <div className="space-y-6">
        <AdminFxRatesPanel />
      </div>
    </AuthGuard>
  );
}
