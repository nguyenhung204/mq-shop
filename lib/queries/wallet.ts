"use client";

import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/lib/api";

export const walletKeys = {
  all: ["wallet"] as const,
  dashboard: () => [...walletKeys.all, "dashboard"] as const,
};

export function useWalletDashboard() {
  return useQuery({
    queryKey: walletKeys.dashboard(),
    queryFn: async () => {
      const [balance, affiliate, network, stats] = await Promise.all([
        walletApi.balance(),
        walletApi.affiliateLink(),
        walletApi.networkTree(),
        walletApi.commissionStats(),
      ]);
      return { balance, affiliate, network, stats: stats as Record<string, unknown> };
    },
  });
}
