"use client";

import { FormEvent, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import type { CreateFinanceConfigBody, FinanceConfig, FinanceConfigStatus } from "@/lib/api/finance";
import {
  useActiveFinanceConfig,
  useApproveFinanceConfig,
  useCreateFinanceConfig,
  useFinanceConfigs,
  useRejectFinanceConfig,
} from "@/lib/queries/finance";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

const STATUSES: Array<FinanceConfigStatus | ""> = [
  "",
  "PENDING_APPROVAL",
  "ACTIVE",
  "REJECTED",
];

type FormState = {
  platformFeePercent: string;
  commissionPercent: string;
  gatewayName: string;
  apiKey: string;
  secretKey: string;
};

const emptyForm = (): FormState => ({
  platformFeePercent: "5.00",
  commissionPercent: "2.00",
  gatewayName: "",
  apiKey: "",
  secretKey: "",
});

function statusBadgeClass(status: FinanceConfigStatus): string {
  switch (status) {
    case "PENDING_APPROVAL":
      return "mq-badge mq-badge-cyan";
    case "ACTIVE":
      return "mq-badge mq-badge-teal";
    case "REJECTED":
      return "mq-badge mq-badge-pink";
    default:
      return "mq-badge mq-badge-muted";
  }
}

function isPercent(value: string): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

function buildBody(form: FormState): CreateFinanceConfigBody | null {
  if (!isPercent(form.platformFeePercent) || !isPercent(form.commissionPercent)) {
    return null;
  }
  const body: CreateFinanceConfigBody = {
    platformFeePercent: form.platformFeePercent.trim(),
    commissionPercent: form.commissionPercent.trim(),
  };
  const gateway = form.gatewayName.trim();
  if (gateway) body.gatewayName = gateway;
  if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();
  if (form.secretKey.trim()) body.secretKey = form.secretKey.trim();
  return body;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function FinanceConfigsInner() {
  const { t } = useLanguage();
  const { hasRole } = useAuth();
  const canSubmit = hasRole("SUPER_ADMIN");
  const canReview = hasRole("ACCOUNTANT") || hasRole("SUPER_ADMIN");

  const [status, setStatus] = useState<FinanceConfigStatus | "">("PENDING_APPROVAL");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [rejectTarget, setRejectTarget] = useState<FinanceConfig | null>(null);

  const { data: active, isLoading: activeLoading } = useActiveFinanceConfig();
  const { data, isLoading, isError, error } = useFinanceConfigs({
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const items = data?.items ?? [];
  const meta = data?.meta;

  const createConfig = useCreateFinanceConfig();
  const approveConfig = useApproveFinanceConfig();
  const rejectConfig = useRejectFinanceConfig();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    const body = buildBody(form);
    if (!body) {
      setFormError(t("admin.financeConfigs.formError"));
      return;
    }
    try {
      await createConfig.mutateAsync(body);
      setForm(emptyForm());
      setShowForm(false);
      setStatus("PENDING_APPROVAL");
      setPage(1);
    } catch {
      /* toast */
    }
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.financeConfigs.title")}
        description={t("admin.financeConfigs.description")}
        actions={
          canSubmit ? (
            <button
              type="button"
              className="mq-btn mq-btn-primary shrink-0 whitespace-nowrap"
              onClick={() => {
                setShowForm((v) => !v);
                setFormError("");
              }}
            >
              <Plus size={16} aria-hidden />
              {showForm ? t("admin.common.hideForm") : t("admin.financeConfigs.submitNew")}
            </button>
          ) : undefined
        }
      />

      <div className="space-y-5">
        {!activeLoading && (
          <div className="mq-card p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-mq-text-muted">
              {t("admin.financeConfigs.activeBanner")}
            </p>
            {active ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className={statusBadgeClass("ACTIVE")}>
                  {t("admin.financeConfigs.status.ACTIVE")}
                </span>
                <span>
                  {t("admin.financeConfigs.platformFee")}:{" "}
                  <strong>{active.platformFeePercent}%</strong>
                </span>
                <span>
                  {t("admin.financeConfigs.commission")}:{" "}
                  <strong>{active.commissionPercent}%</strong>
                </span>
                {active.gatewayName ? (
                  <span>
                    {t("admin.financeConfigs.gateway")}: {active.gatewayName}
                  </span>
                ) : null}
                <span className="text-mq-text-muted">
                  {t("admin.financeConfigs.activatedAt", {
                    when: formatWhen(active.activatedAt),
                  })}
                </span>
              </div>
            ) : (
              <p className="text-sm text-mq-text-muted">
                {t("admin.financeConfigs.noActive")}
              </p>
            )}
          </div>
        )}

        <select
          className="mq-input !w-[14rem] max-w-full"
          value={status}
          aria-label={t("admin.common.filterStatus")}
          onChange={(e) => {
            setStatus(e.target.value as FinanceConfigStatus | "");
            setPage(1);
          }}
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s
                ? t(`admin.financeConfigs.status.${s}`)
                : t("admin.common.allStatuses")}
            </option>
          ))}
        </select>

        {showForm && canSubmit && (
          <form className="mq-card p-5 space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <h3 className="font-semibold">{t("admin.financeConfigs.createHeading")}</h3>
            <p className="text-sm text-mq-text-muted">
              {t("admin.financeConfigs.createHint")}
            </p>
            {formError ? <div className="mq-alert mq-alert-error">{formError}</div> : null}

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">
                  {t("admin.financeConfigs.platformFee")} (%)
                </span>
                <input
                  className="mq-input"
                  inputMode="decimal"
                  value={form.platformFeePercent}
                  onChange={(e) =>
                    setForm({ ...form, platformFeePercent: e.target.value })
                  }
                  required
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">
                  {t("admin.financeConfigs.commission")} (%)
                </span>
                <input
                  className="mq-input"
                  inputMode="decimal"
                  value={form.commissionPercent}
                  onChange={(e) =>
                    setForm({ ...form, commissionPercent: e.target.value })
                  }
                  required
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-mq-text-muted">
                  {t("admin.financeConfigs.gatewayOptional")}
                </span>
                <input
                  className="mq-input"
                  value={form.gatewayName}
                  onChange={(e) => setForm({ ...form, gatewayName: e.target.value })}
                  placeholder="SEED_STUB"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">
                  {t("admin.financeConfigs.apiKeyOptional")}
                </span>
                <input
                  className="mq-input"
                  type="password"
                  autoComplete="off"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">
                  {t("admin.financeConfigs.secretKeyOptional")}
                </span>
                <input
                  className="mq-input"
                  type="password"
                  autoComplete="off"
                  value={form.secretKey}
                  onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                />
              </label>
            </div>

            <button
              type="submit"
              className="mq-btn mq-btn-primary"
              disabled={createConfig.isPending}
            >
              {createConfig.isPending
                ? t("admin.financeConfigs.submitting")
                : t("admin.financeConfigs.submitBtn")}
            </button>
          </form>
        )}

        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : t("admin.common.failed")}
          </div>
        )}

        {isLoading && <AdminCardListSkeleton count={4} />}

        {!isLoading && items.length === 0 && (
          <p className="text-sm text-mq-text-muted">{t("admin.financeConfigs.empty")}</p>
        )}

        {!isLoading &&
          items.map((cfg) => (
            <div
              key={cfg.id}
              className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={statusBadgeClass(cfg.status)}>
                    {t(`admin.financeConfigs.status.${cfg.status}`)}
                  </span>
                  <span className="font-mono text-xs text-mq-text-muted">
                    {cfg.id.slice(0, 8)}…
                  </span>
                </div>
                <p>
                  {t("admin.financeConfigs.platformFee")}:{" "}
                  <strong>{cfg.platformFeePercent}%</strong>
                  {" · "}
                  {t("admin.financeConfigs.commission")}:{" "}
                  <strong>{cfg.commissionPercent}%</strong>
                </p>
                <p className="text-mq-text-muted">
                  {cfg.gatewayName
                    ? `${t("admin.financeConfigs.gateway")}: ${cfg.gatewayName}`
                    : t("admin.financeConfigs.noGateway")}
                  {" · "}
                  {t("admin.financeConfigs.keysHint", {
                    api: cfg.hasApiKey
                      ? t("admin.financeConfigs.keySet")
                      : t("admin.financeConfigs.keyMissing"),
                    secret: cfg.hasSecretKey
                      ? t("admin.financeConfigs.keySet")
                      : t("admin.financeConfigs.keyMissing"),
                  })}
                </p>
                <p className="text-xs text-mq-text-muted">
                  {t("admin.financeConfigs.createdAt", {
                    when: formatWhen(cfg.createdAt),
                  })}
                </p>
                {cfg.status === "REJECTED" && cfg.rejectionReason ? (
                  <p className="text-xs text-mq-text-muted">
                    {t("admin.financeConfigs.rejectionReason", {
                      reason: cfg.rejectionReason,
                    })}
                  </p>
                ) : null}
              </div>

              {canReview && cfg.status === "PENDING_APPROVAL" ? (
                <AdminActions>
                  <AdminIconButton
                    label={t("admin.common.approve")}
                    icon={Check}
                    tone="approve"
                    disabled={approveConfig.isPending}
                    onClick={() => void approveConfig.mutateAsync(cfg.id)}
                  />
                  <AdminIconButton
                    label={t("admin.common.reject")}
                    icon={X}
                    tone="reject"
                    disabled={rejectConfig.isPending}
                    onClick={() => setRejectTarget(cfg)}
                  />
                </AdminActions>
              ) : null}
            </div>
          ))}

        {meta && <PaginationBar page={page} meta={meta} onPageChange={setPage} />}
      </div>

      <AdminReasonModal
        open={Boolean(rejectTarget)}
        title={t("admin.financeConfigs.rejectTitle")}
        description={
          rejectTarget
            ? t("admin.financeConfigs.rejectDesc", {
                fee: rejectTarget.platformFeePercent,
              })
            : undefined
        }
        confirmLabel={t("admin.financeConfigs.rejectBtn")}
        maxLength={500}
        busy={rejectConfig.isPending}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (!rejectTarget) return;
          await rejectConfig.mutateAsync({ id: rejectTarget.id, reason });
          setRejectTarget(null);
        }}
      />
    </>
  );
}

export default function AdminFinanceConfigsPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN", "ACCOUNTANT"]} permissions={["CONFIG_FEE"]}>
      <FinanceConfigsInner />
    </AuthGuard>
  );
}
