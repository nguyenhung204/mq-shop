"use client";

import { useCallback, useState } from "react";
import { useMlmRanks, usePromotionRules } from "@/lib/queries/wallet";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";
import RankTree from "@/components/rankTree/RankTree";
import { UserDetailDrawer } from "@/components/rankTree/UserDetailDrawer";
import type { UserSummary } from "@/components/rankTree/types";
import type { Rank, PromotionRule } from "@/components/rankTree/mockData";
import { MOCK_RANKS, MOCK_RULES } from "@/components/rankTree/mockData";

export default function AdminRankTreePage() {
  const { t, locale } = useLanguage();
  const { hasRole } = useAuth();

  const canView =
    hasRole("SUPER_ADMIN") || hasRole("ACCOUNTANT") || hasRole("ADMIN");

  const {
    data: apiRanks,
    isLoading: ranksLoading,
    isError: ranksIsError,
    error: ranksError,
  } = useMlmRanks({ enabled: canView });

  const {
    data: apiRules,
    isLoading: rulesLoading,
    isError: rulesIsError,
    error: rulesError,
  } = usePromotionRules({ enabled: canView });

  const [rootRank, setRootRank] = useState(10);
  const [minRank, setMinRank] = useState(1);

  // Drawer state
  const [drawerUser, setDrawerUser] = useState<UserSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isLoading = ranksLoading || rulesLoading;
  const isError = ranksIsError || rulesIsError;

  // Use API data if available, fallback to mock data
  const ranks: Rank[] = apiRanks
    ? apiRanks.map((r) => ({
        rank: r.rank,
        name: r.name,
        nameI18n: {
          en: r.nameI18n?.en ?? r.name,
          vi: r.nameI18n?.vi ?? r.name,
          "zh-TW": r.nameI18n?.["zh-TW"] ?? r.name,
        },
        teamPercent: r.teamPercent,
        referralPercent: r.referralPercent,
        globalFundTier: r.globalFundTier,
        isActive: r.isActive,
      }))
    : MOCK_RANKS;

  const rules: PromotionRule[] = apiRules
    ? apiRules.map((r) => ({
        id: r.id,
        fromRank: r.fromRank,
        toRank: r.toRank,
        mode: r.mode as PromotionRule["mode"],
        requiredF1Rank: r.requiredF1Rank,
        count: r.count,
        isActive: r.isActive,
      }))
    : MOCK_RULES;

  /**
   * Khi admin click vào một user node → mở drawer.
   *
   * Trong production, gọi API:
   * GET /admin/mlm/tree/:userId/summary
   *
   * Hiện tại dùng mock data từ node id.
   */
  const handleUserClick = useCallback(
    (userId: string) => {
      // Mock: tạo UserSummary từ userId
      // Trong production: fetch từ API
      const mockSummary: UserSummary = {
        id: userId,
        userName: userId.includes("root") ? "Seed Seller" : `User ${userId.slice(-3)}`,
        email: `${userId.slice(0, 8)}@example.com`,
        rank: extractRankFromId(userId),
        rankName: getRankNameFromRanks(extractRankFromId(userId), ranks),
        f1Count: 3,
        teamCount: 12,
        isActive: true,
        children: [
          {
            id: `${userId}-child-1`,
            userName: "Nguyễn Văn A",
            rank: Math.max(extractRankFromId(userId) - 1, 0),
            rankName: getRankNameFromRanks(Math.max(extractRankFromId(userId) - 1, 0), ranks),
            isActive: true,
          },
          {
            id: `${userId}-child-2`,
            userName: "Trần Thị B",
            rank: Math.max(extractRankFromId(userId) - 1, 0),
            rankName: getRankNameFromRanks(Math.max(extractRankFromId(userId) - 1, 0), ranks),
            isActive: true,
          },
          {
            id: `${userId}-child-3`,
            userName: "Lê Hoàng C",
            rank: Math.max(extractRankFromId(userId) - 1, 0),
            rankName: getRankNameFromRanks(Math.max(extractRankFromId(userId) - 1, 0), ranks),
            isActive: false,
          },
        ],
      };

      setDrawerUser(mockSummary);
      setDrawerOpen(true);
    },
    [ranks],
  );

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setDrawerUser(null);
  }, []);

  return (
    <>
      <AdminPageHeader
        title={t("admin.rankTree.title")}
        description={t("admin.rankTree.description")}
      />

      <div className="space-y-4 w-full">
        {!canView ? (
          <div className="mq-alert mq-alert-error text-sm">
            {t("admin.rankTree.noPermission")}
          </div>
        ) : isLoading ? (
          <AdminCardListSkeleton count={3} />
        ) : isError ? (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(ranksError || rulesError, t("admin.rankTree.loadError"))}
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="mq-card p-4 flex flex-wrap items-end gap-4">
              <label className="block text-xs space-y-1">
                <span className="text-mq-text-muted font-medium">{t("admin.rankTree.rootRank")}</span>
                <select
                  className="mq-input"
                  value={rootRank}
                  onChange={(e) => setRootRank(Number(e.target.value))}
                >
                  {ranks
                    .filter((r) => r.isActive)
                    .sort((a, b) => b.rank - a.rank)
                    .map((r) => (
                      <option key={r.rank} value={r.rank}>
                        R{r.rank} — {(locale && r.nameI18n?.[locale]) || r.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block text-xs space-y-1">
                <span className="text-mq-text-muted font-medium">{t("admin.rankTree.minRank")}</span>
                <select
                  className="mq-input"
                  value={minRank}
                  onChange={(e) => setMinRank(Number(e.target.value))}
                >
                  {ranks
                    .filter((r) => r.rank < rootRank && r.isActive)
                    .sort((a, b) => a.rank - b.rank)
                    .map((r) => (
                      <option key={r.rank} value={r.rank}>
                        R{r.rank} — {(locale && r.nameI18n?.[locale]) || r.name}
                      </option>
                    ))}
                </select>
              </label>

              <div className="text-xs text-mq-text-muted">
                {t("admin.rankTree.displayRange", { from: String(rootRank), to: String(minRank) })}
                <br />
                <span className="text-[10px]">
                  {t("admin.rankTree.hintClick")} &nbsp;|&nbsp; {t("admin.rankTree.hintExpand")}
                </span>
              </div>
            </div>

            {/* Rank Tree Visualization */}
            <div className="mq-card overflow-hidden">
              <RankTree
                ranks={ranks}
                rules={rules}
                rootRank={rootRank}
                minRank={minRank}
                height="calc(100vh - 280px)"
                locale={locale ?? undefined}
                labels={{
                  expand: t("admin.rankTree.expand"),
                  users: t("admin.rankTree.users"),
                  loading: t("admin.rankTree.loading"),
                  f1Label: t("admin.rankTree.f1Label"),
                  teamLabel: t("admin.rankTree.teamLabel"),
                }}
                onUserClick={handleUserClick}
              />
            </div>
          </>
        )}
      </div>

      {/* User Detail Drawer */}
      <UserDetailDrawer
        user={drawerUser}
        open={drawerOpen}
        onClose={handleDrawerClose}
        labels={{
          title: t("admin.rankTree.drawer.title"),
          status: t("admin.rankTree.drawer.status"),
          active: t("admin.rankTree.drawer.active"),
          inactive: t("admin.rankTree.drawer.inactive"),
          f1Direct: t("admin.rankTree.drawer.f1Direct"),
          totalTeam: t("admin.rankTree.drawer.totalTeam"),
          f1List: t("admin.rankTree.drawer.f1List"),
        }}
      />
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract rank number from mock node id like "user-root-r10" or "user-f1-r9-0".
 */
function extractRankFromId(id: string): number {
  const match = id.match(/r(\d+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Get rank name from ranks array by rank number.
 */
function getRankNameFromRanks(rank: number, ranks: Rank[]): string {
  const found = ranks.find((r) => r.rank === rank);
  return found?.name ?? `Rank ${rank}`;
}
