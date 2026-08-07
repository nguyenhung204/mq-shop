"use client";

import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { PromotionRule } from "@/lib/api/mlm";
import {
  useCreatePromotionRule,
  useCreateRankConfig,
  useDeletePromotionRule,
  usePromotionRules,
  useUpdatePromotionRule,
} from "@/lib/queries/wallet";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getErrorMessage } from "@/lib/queries/utils";

function modeLabel(mode: string, t: (k: string) => string): string {
  if (mode === "qualify_orders") return t("admin.mlm.rules.modeQualifyOrders");
  if (mode === "seller_granted") return t("admin.mlm.rules.modeSellerGranted");
  return t("admin.mlm.rules.modeF1Rank");
}

export function MlmPromotionRulesSection() {
  const { t } = useLanguage();
  const { data: rules, isLoading, isError, error } = usePromotionRules();
  const createRule = useCreatePromotionRule();
  const updateRule = useUpdatePromotionRule();
  const deleteRule = useDeletePromotionRule();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState({
    fromRank: "",
    toRank: "",
    mode: "f1_rank" as "qualify_orders" | "f1_rank" | "seller_granted",
    requiredF1Rank: "",
    count: "2",
    isActive: true,
  });

  const resetForm = () => {
    setForm({ fromRank: "", toRank: "", mode: "f1_rank", requiredF1Rank: "", count: "2", isActive: true });
  };

  const openCreate = () => {
    resetForm();
    setEditingId(null);
    setCreating(true);
  };

  const openEdit = (rule: PromotionRule) => {
    setCreating(false);
    setEditingId(rule.id);
    setForm({
      fromRank: String(rule.fromRank),
      toRank: String(rule.toRank),
      mode: rule.mode,
      requiredF1Rank: rule.requiredF1Rank != null ? String(rule.requiredF1Rank) : "",
      count: String(rule.count),
      isActive: rule.isActive,
    });
  };

  const onSubmitCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createRule.mutateAsync({
      fromRank: Number(form.fromRank),
      toRank: Number(form.toRank),
      mode: form.mode,
      requiredF1Rank: form.mode === "f1_rank" ? Number(form.requiredF1Rank) : null,
      count: Number(form.count),
    });
    setCreating(false);
    resetForm();
  };

  const onSubmitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (editingId == null) return;
    await updateRule.mutateAsync({
      id: editingId,
      body: {
        fromRank: Number(form.fromRank),
        toRank: Number(form.toRank),
        mode: form.mode,
        requiredF1Rank: form.mode === "f1_rank" ? Number(form.requiredF1Rank) : null,
        count: Number(form.count),
        isActive: form.isActive,
      },
    });
    setEditingId(null);
    resetForm();
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">{t("admin.mlm.rules.title")}</h2>
        <button
          type="button"
          className="mq-admin-btn mq-admin-btn-approve"
          onClick={openCreate}
        >
          <Plus size={14} />
          {t("admin.mlm.rules.create")}
        </button>
      </div>
      <p className="text-xs text-mq-text-muted">{t("admin.mlm.rules.hint")}</p>

      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      )}

      {isLoading ? (
        <AdminCardListSkeleton count={3} />
      ) : (rules ?? []).length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("admin.mlm.rules.empty")}</p>
      ) : (
        <div className="mq-table-wrap overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="border-b border-mq-border bg-mq-surface-subtle text-left text-mq-text-muted">
                <th className="px-3 py-2 font-medium">{t("admin.mlm.rules.from")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.mlm.rules.to")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.mlm.rules.mode")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.mlm.rules.requiredF1")}</th>
                <th className="px-3 py-2 font-medium">{t("admin.mlm.rules.count")}</th>
                <th className="px-3 py-2 font-medium text-center">{t("admin.common.status")}</th>
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {(rules ?? []).map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-mq-border last:border-0 hover:bg-mq-surface-subtle/60"
                >
                  <td className="px-3 py-1.5 font-semibold">Rank {r.fromRank}</td>
                  <td className="px-3 py-1.5 font-semibold">Rank {r.toRank}</td>
                  <td className="px-3 py-1.5">{modeLabel(r.mode, t)}</td>
                  <td className="px-3 py-1.5">
                    {r.requiredF1Rank != null ? `≥ Rank ${r.requiredF1Rank}` : "—"}
                  </td>
                  <td className="px-3 py-1.5">{r.count}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span
                      className={
                        r.isActive
                          ? "mq-badge mq-badge-cyan !text-[10px] !px-1.5 !py-0"
                          : "mq-badge mq-badge-muted !text-[10px] !px-1.5 !py-0"
                      }
                    >
                      {r.isActive ? t("admin.mlm.rankActive") : t("admin.mlm.rankInactive")}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 flex gap-1">
                    <button
                      type="button"
                      className="text-mq-text-muted hover:text-mq-text"
                      title={t("admin.common.edit")}
                      onClick={() => openEdit(r)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="text-mq-text-muted hover:text-red-500"
                      title={t("admin.common.delete")}
                      onClick={() => setDeleteId(r.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit form */}
      {(creating || editingId != null) && (
        <div className="mq-card p-4 border-l-4 border-[#e7ba0a] space-y-3">
          <h3 className="text-sm font-medium">
            {creating ? t("admin.mlm.rules.create") : t("admin.mlm.rules.edit")}
          </h3>
          <form
            className="grid sm:grid-cols-3 gap-3"
            onSubmit={creating ? onSubmitCreate : onSubmitEdit}
          >
            <label className="block text-xs space-y-1">
              <span className="text-mq-text-muted">{t("admin.mlm.rules.from")}</span>
              <input
                className="mq-input"
                type="number"
                min="0"
                value={form.fromRank}
                onChange={(e) => setForm({ ...form, fromRank: e.target.value })}
                required
              />
            </label>
            <label className="block text-xs space-y-1">
              <span className="text-mq-text-muted">{t("admin.mlm.rules.to")}</span>
              <input
                className="mq-input"
                type="number"
                min="1"
                value={form.toRank}
                onChange={(e) => setForm({ ...form, toRank: e.target.value })}
                required
              />
            </label>
            <label className="block text-xs space-y-1">
              <span className="text-mq-text-muted">{t("admin.mlm.rules.mode")}</span>
              <select
                className="mq-input"
                value={form.mode}
                onChange={(e) =>
                  setForm({ ...form, mode: e.target.value as "qualify_orders" | "f1_rank" | "seller_granted" })
                }
              >
                <option value="f1_rank">{t("admin.mlm.rules.modeF1Rank")}</option>
                <option value="qualify_orders">{t("admin.mlm.rules.modeQualifyOrders")}</option>
                <option value="seller_granted">{t("admin.mlm.rules.modeSellerGranted")}</option>
              </select>
            </label>
            {form.mode === "f1_rank" && (
              <label className="block text-xs space-y-1">
                <span className="text-mq-text-muted">{t("admin.mlm.rules.requiredF1")}</span>
                <input
                  className="mq-input"
                  type="number"
                  min="0"
                  value={form.requiredF1Rank}
                  onChange={(e) => setForm({ ...form, requiredF1Rank: e.target.value })}
                  required
                />
              </label>
            )}
            <label className="block text-xs space-y-1">
              <span className="text-mq-text-muted">{t("admin.mlm.rules.count")}</span>
              <input
                className="mq-input"
                type="number"
                min="1"
                value={form.count}
                onChange={(e) => setForm({ ...form, count: e.target.value })}
                required
              />
            </label>
            {editingId != null && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="accent-[#e7ba0a]"
                />
                <span>{t("admin.mlm.rankActive")}</span>
              </label>
            )}
            <div className="sm:col-span-3 flex gap-2">
              <button
                type="submit"
                className="mq-btn mq-btn-primary text-xs"
                disabled={createRule.isPending || updateRule.isPending}
              >
                {t("admin.common.save")}
              </button>
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                onClick={() => { setCreating(false); setEditingId(null); resetForm(); }}
              >
                {t("admin.common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={deleteId != null}
        title={t("admin.mlm.rules.deleteTitle")}
        description={t("admin.mlm.rules.deleteDesc")}
        confirmLabel={t("admin.common.delete")}
        tone="danger"
        busy={deleteRule.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId == null) return;
          await deleteRule.mutateAsync(deleteId);
          setDeleteId(null);
        }}
      />
    </section>
  );
}

export function MlmCreateRankSection() {
  const { t } = useLanguage();
  const createRank = useCreateRankConfig();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    rank: "",
    name: "",
    nameVi: "",
    nameEn: "",
    nameZhTw: "",
    teamPercent: "0",
    referralPercent: "10",
    globalFundTier: "",
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nameI18n: Record<string, string> = {};
    if (form.nameVi.trim()) nameI18n.vi = form.nameVi.trim();
    if (form.nameEn.trim()) nameI18n.en = form.nameEn.trim();
    if (form.nameZhTw.trim()) nameI18n["zh-TW"] = form.nameZhTw.trim();
    await createRank.mutateAsync({
      rank: Number(form.rank),
      name: form.name.trim(),
      nameI18n: Object.keys(nameI18n).length > 0 ? nameI18n : undefined,
      teamPercent: Number(form.teamPercent),
      referralPercent: Number(form.referralPercent),
      globalFundTier: form.globalFundTier.trim() ? Number(form.globalFundTier) : null,
    });
    setOpen(false);
    setForm({ rank: "", name: "", nameVi: "", nameEn: "", nameZhTw: "", teamPercent: "0", referralPercent: "10", globalFundTier: "" });
  };

  if (!open) {
    return (
      <button
        type="button"
        className="mq-admin-btn mq-admin-btn-approve"
        onClick={() => setOpen(true)}
      >
        <Plus size={14} />
        {t("admin.mlm.createRank")}
      </button>
    );
  }

  return (
    <div className="mq-card p-4 border-l-4 border-[#e7ba0a] space-y-3">
      <h3 className="text-sm font-medium">{t("admin.mlm.createRank")}</h3>
      <form className="grid sm:grid-cols-3 gap-3" onSubmit={(e) => void onSubmit(e)}>
        <label className="block text-xs space-y-1">
          <span className="text-mq-text-muted">Rank #</span>
          <input
            className="mq-input"
            type="number"
            min="1"
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
            required
          />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-mq-text-muted">{t("admin.mlm.rankName")}</span>
          <input
            className="mq-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-mq-text-muted">🇻🇳 Tiếng Việt</span>
          <input
            className="mq-input"
            value={form.nameVi}
            onChange={(e) => setForm({ ...form, nameVi: e.target.value })}
            placeholder={form.name}
          />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-mq-text-muted">🇬🇧 English</span>
          <input
            className="mq-input"
            value={form.nameEn}
            onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
          />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-mq-text-muted">🇹🇼 繁體中文</span>
          <input
            className="mq-input"
            value={form.nameZhTw}
            onChange={(e) => setForm({ ...form, nameZhTw: e.target.value })}
          />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-mq-text-muted">{t("admin.mlm.team")} %</span>
          <input
            className="mq-input"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.teamPercent}
            onChange={(e) => setForm({ ...form, teamPercent: e.target.value })}
            required
          />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-mq-text-muted">{t("admin.mlm.referral")} %</span>
          <input
            className="mq-input"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.referralPercent}
            onChange={(e) => setForm({ ...form, referralPercent: e.target.value })}
            required
          />
        </label>
        <label className="block text-xs space-y-1">
          <span className="text-mq-text-muted">{t("admin.mlm.globalTier")}</span>
          <input
            className="mq-input"
            type="number"
            step="1"
            min="1"
            value={form.globalFundTier}
            onChange={(e) => setForm({ ...form, globalFundTier: e.target.value })}
            placeholder="—"
          />
        </label>
        <div className="sm:col-span-3 flex gap-2">
          <button
            type="submit"
            className="mq-btn mq-btn-primary text-xs"
            disabled={createRank.isPending}
          >
            {createRank.isPending ? t("admin.common.working") : t("admin.common.create")}
          </button>
          <button
            type="button"
            className="mq-btn mq-btn-outline text-xs"
            onClick={() => setOpen(false)}
          >
            {t("admin.common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
