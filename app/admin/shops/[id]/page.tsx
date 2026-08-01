"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  useAdminShop,
  useApproveShop,
  useRejectShop,
  useSuspendShop,
  useUnlockShop,
} from "@/lib/queries/admin";
import type { LocalizedText } from "@/lib/api/types";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { getErrorMessage } from "@/lib/queries/utils";
import { Check, ShieldAlert, ShieldCheck, X } from "lucide-react";

function reasonText(reason: string | LocalizedText | null | undefined): string {
  if (!reason) return "";
  if (typeof reason === "string") return reason;
  return reason.vi || reason.en || "";
}

function ShopDetailInner({ id }: { id: string }) {
  const { t } = useLanguage();
  const [reasonKind, setReasonKind] = useState<"reject" | "violation" | null>(null);
  const { data: shop, isLoading, isError, error } = useAdminShop(id);
  const approveShop = useApproveShop();
  const rejectShop = useRejectShop();
  const suspendShop = useSuspendShop();
  const unlockShop = useUnlockShop();

  const docUrl = shop?.documentUrl || shop?.legalDocumentUrl;
  const busy =
    approveShop.isPending ||
    rejectShop.isPending ||
    suspendShop.isPending ||
    unlockShop.isPending;
  const modalBusy =
    reasonKind === "reject" ? rejectShop.isPending : suspendShop.isPending;

  return (
    <>
      <AdminPageHeader
        title={shop?.name || t("admin.shops.detailTitle")}
        description={t("admin.shops.description")}
      />
      <div className="space-y-6 max-w-3xl">
        <Link href="/admin/shops" className="text-sm text-mq-text-muted hover:text-mq-text">
          ← {t("admin.shops.backToQueue")}
        </Link>

        {isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(error, t("admin.common.failed"))}
          </div>
        )}
        {isLoading && <p className="text-sm text-mq-text-muted">{t("admin.common.loading")}</p>}

        {shop && (
          <div className="mq-card p-6 space-y-4 text-sm">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-mq-text">{shop.name}</h2>
                <p className="text-xs text-mq-text-muted mt-1 font-mono">{shop.id}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 h-fit">
                <span className="mq-badge mq-badge-cyan">
                  {translateStatus(t, "shop", shop.status)}
                </span>
                {shop.isSuspended ? (
                  <span className="mq-badge mq-badge-pink">{t("admin.shops.suspended")}</span>
                ) : null}
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-mq-text-muted">{t("admin.shops.taxId")}</dt>
                <dd>{shop.taxId || shop.taxCode || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-mq-text-muted">{t("admin.shops.country")}</dt>
                <dd>{shop.countryCode || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-mq-text-muted">{t("admin.shops.owner")}</dt>
                <dd>
                  {shop.ownerName || shop.ownerEmail
                    ? <span>{shop.ownerName ?? "—"}{shop.ownerEmail ? <span className="text-mq-text-muted ml-1">({shop.ownerEmail})</span> : null}</span>
                    : <span className="font-mono text-xs">{shop.ownerId || "—"}</span>
                  }
                </dd>
              </div>
              <div>
                <dt className="text-xs text-mq-text-muted">{t("admin.shops.flags")}</dt>
                <dd>
                  {shop.isSuspended
                    ? t("admin.shops.flagSuspended")
                    : shop.violationFlag || shop.contactAdminRequired
                      ? t("admin.shops.flagViolation")
                      : t("admin.shops.flagNone")}
                </dd>
              </div>
              {shop.pickupAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-mq-text-muted">{t("admin.shops.pickupAddress")}</dt>
                  <dd>{shop.pickupAddress}</dd>
                </div>
              )}
              {reasonText(shop.rejectionReason) && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-mq-text-muted">{t("admin.common.reason")}</dt>
                  <dd>{reasonText(shop.rejectionReason)}</dd>
                </div>
              )}
            </dl>

            {docUrl && (
              <div>
                <p className="text-xs text-mq-text-muted mb-2">{t("admin.shops.legalDocument")}</p>
                {/\.(jpg|jpeg|png|webp|gif)$/i.test(docUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={docUrl}
                    alt={t("admin.shops.legalDocument")}
                    className="max-h-64 rounded border border-mq-border object-contain bg-mq-surface-subtle"
                  />
                ) : (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline"
                  >
                    {t("admin.shops.openDocument")}
                  </a>
                )}
              </div>
            )}

            {(shop.logoUrl || shop.bannerUrl) && (
              <div className="flex flex-wrap gap-4">
                {shop.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shop.logoUrl}
                    alt="Logo"
                    className="w-16 h-16 rounded object-cover border border-mq-border"
                  />
                )}
                {shop.bannerUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shop.bannerUrl}
                    alt="Banner"
                    className="h-16 max-w-xs rounded object-cover border border-mq-border"
                  />
                )}
              </div>
            )}

            <div className="pt-2 border-t border-mq-border">
              <AdminActions>
                <AdminIconButton
                  label={t("admin.common.approve")}
                  icon={Check}
                  tone="approve"
                  disabled={busy || shop.status !== "PENDING"}
                  onClick={() => void approveShop.mutateAsync(shop.id)}
                />
                <AdminIconButton
                  label={t("admin.common.reject")}
                  icon={X}
                  tone="reject"
                  disabled={busy || shop.status !== "PENDING"}
                  onClick={() => setReasonKind("reject")}
                />
                <AdminIconButton
                  label={t("admin.shops.violationLock")}
                  icon={ShieldAlert}
                  tone="warn"
                  disabled={
                    busy || shop.status !== "APPROVED" || Boolean(shop.isSuspended)
                  }
                  onClick={() => setReasonKind("violation")}
                />
                <AdminIconButton
                  label={t("admin.shops.violationUnlock")}
                  icon={ShieldCheck}
                  tone="approve"
                  disabled={busy || !shop.isSuspended}
                  onClick={() => void unlockShop.mutateAsync(shop.id)}
                />
              </AdminActions>
              {shop.status === "REJECTED" && !shop.isSuspended ? (
                <p className="text-xs text-mq-text-muted mt-3 leading-relaxed">
                  {t("admin.shops.rejectOnlyHint")}
                </p>
              ) : null}
              {shop.isSuspended ? (
                <p className="text-xs text-mq-text-muted mt-3 leading-relaxed">
                  {t("admin.shops.unlockHint")}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <AdminReasonModal
        open={!!reasonKind && !!shop}
        title={
          reasonKind === "reject"
            ? t("admin.shops.rejectTitle")
            : t("admin.shops.violationLock")
        }
        description={
          shop
            ? reasonKind === "reject"
              ? t("admin.shops.rejectDesc", { name: shop.name })
              : t("admin.shops.lockDesc", { name: shop.name })
            : undefined
        }
        confirmLabel={
          reasonKind === "reject" ? t("admin.common.reject") : t("admin.shops.lockTitle")
        }
        required={reasonKind === "reject"}
        busy={modalBusy}
        onClose={() => {
          if (!modalBusy) setReasonKind(null);
        }}
        onConfirm={async (reason) => {
          if (!shop || !reasonKind) return;
          if (reasonKind === "reject") {
            await rejectShop.mutateAsync({ id: shop.id, reason });
          } else {
            await suspendShop.mutateAsync({
              id: shop.id,
              reason: reason || undefined,
            });
          }
          setReasonKind(null);
        }}
      />
    </>
  );
}

export default function AdminShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["APPROVE_SELLER", "APPROVE_SHOP", "SUSPEND_SHOP"]}
    >
      <ShopDetailInner id={id} />
    </AuthGuard>
  );
}
