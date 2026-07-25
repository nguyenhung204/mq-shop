"use client";

import { FormEvent, useState } from "react";
import { formatPercent } from "@/lib/api/utils";
import { useMlmRanks, useSetMlmRank } from "@/lib/queries/wallet";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

function MlmAdminInner() {
  const { t } = useLanguage();
  const { data: ranks, isLoading, isError, error } = useMlmRanks();
  const setRank = useSetMlmRank();

  const [userId, setUserId] = useState("");
  const [rank, setRankValue] = useState("5");
  const [formError, setFormError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setOkMsg("");
    const id = userId.trim();
    const n = Number(rank);
    if (!id) {
      setFormError(t("admin.mlm.userIdRequired"));
      return;
    }
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      setFormError(t("admin.mlm.rankInvalid"));
      return;
    }
    try {
      const res = await setRank.mutateAsync({ userId: id, body: { rank: n } });
      setOkMsg(
        t("admin.mlm.rankUpdated", {
          email: res.email,
          rank: String(res.mlmRank),
          name: res.rankName,
        }),
      );
    } catch {
      /* toast from hook */
    }
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.mlm.title")}
        description={t("admin.mlm.description")}
      />

      <div className="space-y-6 max-w-3xl">
        <p className="text-sm text-mq-text-muted">{t("admin.mlm.hint")}</p>

        <section className="space-y-3">
          <h2 className="text-lg">{t("admin.mlm.ranksTitle")}</h2>
          {isLoading ? <AdminCardListSkeleton count={5} /> : null}
          {isError ? (
            <div className="mq-alert mq-alert-error">
              {error instanceof Error ? error.message : t("admin.common.failed")}
            </div>
          ) : null}
          {(ranks ?? []).map((r) => (
            <div
              key={r.rank}
              className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {t("wallet.rank")} {r.rank} · {r.name}
                </p>
                <p className="text-xs text-mq-text-muted mt-1">
                  {t("admin.mlm.team")}: {formatPercent(r.teamPercent)} ·{" "}
                  {t("admin.mlm.referral")}: {formatPercent(r.referralPercent)}
                  {r.globalFundTier != null
                    ? ` · ${t("admin.mlm.globalTier")}: ≥${r.globalFundTier}`
                    : ""}
                </p>
              </div>
              <span className={r.isActive ? "mq-badge mq-badge-cyan" : "mq-badge mq-badge-muted"}>
                {r.isActive ? t("admin.common.active") : t("admin.common.hidden")}
              </span>
            </div>
          ))}
        </section>

        <section className="mq-card p-5 space-y-3">
          <h2 className="text-lg">{t("admin.mlm.setRankTitle")}</h2>
          <p className="text-sm text-mq-text-muted">{t("admin.mlm.setRankHint")}</p>
          {formError ? <div className="mq-alert mq-alert-error">{formError}</div> : null}
          {okMsg ? <div className="mq-alert mq-alert-success">{okMsg}</div> : null}
          <form className="flex flex-wrap gap-3 items-end" onSubmit={(e) => void onSubmit(e)}>
            <label className="block text-sm">
              <span className="text-xs text-mq-text-muted">{t("admin.mlm.userId")}</span>
              <input
                className="mq-input mt-1 min-w-[16rem]"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="uuid"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-mq-text-muted">{t("wallet.rank")}</span>
              <select
                className="mq-input mt-1 !w-[6rem]"
                value={rank}
                onChange={(e) => setRankValue(e.target.value)}
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="mq-btn mq-btn-primary"
              disabled={setRank.isPending}
            >
              {setRank.isPending ? t("admin.common.saving") : t("admin.mlm.setRank")}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

export default function AdminMlmPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN"]} permissions={["CONFIG_MLM"]}>
      <MlmAdminInner />
    </AuthGuard>
  );
}
