"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { Stars } from "@/components/ui/shared";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import {
  useAdminHideReview,
  useAdminReviews,
  useAdminUnhideReview,
} from "@/lib/queries/reviews";

const STATUS_FILTERS = ["", "VISIBLE", "HIDDEN"] as const;

function statusBadgeClass(status: string | undefined): string {
  if (status === "HIDDEN") return "mq-badge mq-badge-pink";
  if (status === "VISIBLE") return "mq-badge mq-badge-teal";
  return "mq-badge mq-badge-muted";
}

function AdminReviewsInner() {
  const { t } = useLanguage();
  const [status, setStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [shopId, setShopId] = useState("");
  const [page, setPage] = useState(1);
  const [hideId, setHideId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useAdminReviews({
    status: status || undefined,
    productId: productId || undefined,
    shopId: shopId || undefined,
    page,
    pageSize: 20,
  });
  const hideReview = useAdminHideReview();
  const unhideReview = useAdminUnhideReview();

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <>
      <AdminPageHeader
        title={t("admin.reviews.title")}
        description={t("admin.reviews.description")}
      />
      <div className="space-y-6">
        {isError ? (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : t("admin.common.failed")}
          </div>
        ) : null}

        <div className="mq-admin-panel p-4 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-mq-text-muted">{t("admin.common.filterStatus")}</span>
            <select
              className="mq-input !w-[10rem]"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s || "all"} value={s}>
                  {s === "" ? t("admin.common.allStatuses") : translateStatus(t, "review", s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-mq-text-muted">{t("admin.reviews.productId")}</span>
            <input
              className="mq-input max-w-xs"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value.trim());
                setPage(1);
              }}
              placeholder="UUID"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-mq-text-muted">{t("admin.reviews.shopId")}</span>
            <input
              className="mq-input max-w-xs"
              value={shopId}
              onChange={(e) => {
                setShopId(e.target.value.trim());
                setPage(1);
              }}
              placeholder="UUID"
            />
          </label>
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("admin.reviews.empty")}</p>
        ) : (
          <div className="mq-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-mq-surface-subtle text-left">
                <tr>
                  <th className="p-3">{t("admin.reviews.product")}</th>
                  <th className="p-3">{t("admin.reviews.buyer")}</th>
                  <th className="p-3">{t("product.reviewsPage.rating")}</th>
                  <th className="p-3">{t("admin.common.status")}</th>
                  <th className="p-3">{t("product.reviewsPage.comment")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-mq-border align-top">
                    <td className="p-3 font-mono text-xs">
                      {(r.productId || "").slice(0, 8)}…
                    </td>
                    <td className="p-3 text-xs">
                      {r.buyer?.fullName?.trim() || "—"}
                      {r.buyer?.id ? (
                        <span className="block font-mono text-[10px] text-mq-text-muted mt-0.5">
                          {r.buyer.id.slice(0, 8)}…
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <Stars rating={r.rating} />
                    </td>
                    <td className="p-3">
                      <span className={statusBadgeClass(r.status)}>
                        {translateStatus(t, "review", r.status || "VISIBLE")}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-mq-text-secondary max-w-xs">
                      <p className="line-clamp-3 whitespace-pre-wrap">{r.comment || "—"}</p>
                      {r.reply?.body ? (
                        <p className="mt-1 text-[11px] text-mq-text-muted line-clamp-2">
                          {t("product.reviewsPage.sellerReply")}: {r.reply.body}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <AdminActions>
                        {r.status === "HIDDEN" ? (
                          <AdminIconButton
                            label={t("admin.reviews.unhide")}
                            icon={Eye}
                            tone="approve"
                            disabled={unhideReview.isPending}
                            onClick={() => void unhideReview.mutateAsync(r.id)}
                          />
                        ) : (
                          <AdminIconButton
                            label={t("admin.reviews.hide")}
                            icon={EyeOff}
                            tone="warn"
                            disabled={hideReview.isPending}
                            onClick={() => setHideId(r.id)}
                          />
                        )}
                      </AdminActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar page={page} meta={meta} onPageChange={setPage} />
      </div>

      <AdminReasonModal
        open={Boolean(hideId)}
        title={t("admin.reviews.hideTitle")}
        description={t("admin.reviews.hideDesc")}
        confirmLabel={t("admin.reviews.hide")}
        required={false}
        maxLength={500}
        busy={hideReview.isPending}
        onClose={() => setHideId(null)}
        onConfirm={async (reason) => {
          if (!hideId) return;
          await hideReview.mutateAsync({
            reviewId: hideId,
            reason: reason || undefined,
          });
          setHideId(null);
        }}
      />
    </>
  );
}

export default function AdminReviewsPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]}>
      <AdminReviewsInner />
    </AuthGuard>
  );
}
