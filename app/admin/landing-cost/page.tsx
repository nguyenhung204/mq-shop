"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { LandingCostCalculator } from "@/components/finance/LandingCostCalculator";
import { useLanguage } from "@/components/providers/LanguageProvider";

function AdminLandingCostInner() {
  const { t } = useLanguage();
  return (
    <>
      <AdminPageHeader
        title={t("admin.landingCost.title")}
        description={t("admin.landingCost.description")}
      />
      <LandingCostCalculator />
    </>
  );
}

export default function AdminLandingCostPage() {
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN", "ACCOUNTANT"]}
      permissions={["CALC_LAND_COST"]}
    >
      <AdminLandingCostInner />
    </AuthGuard>
  );
}
