"use client";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { LandingCostCalculator } from "@/components/finance/LandingCostCalculator";

function SellerLandingCostInner() {
  return <LandingCostCalculator />;
}

export default function SellerLandingCostPage() {
  return (
    <AuthGuard roles={["SELLER"]} permissions={["CALC_LAND_COST"]}>
      <SellerLandingCostInner />
    </AuthGuard>
  );
}
