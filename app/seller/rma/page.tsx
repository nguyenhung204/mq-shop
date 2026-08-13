"use client";

import Link from "next/link";
import { useState } from "react";
import type { RmaStatus } from "@/lib/api/orders";
import { useShopRma, useShopRmaAction } from "@/lib/queries/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminReasonModal } from "@/components/admin/AdminReasonModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

function isRequested(status: RmaStatus) {
  return status === "REQUESTED" || status === "PENDING";
}

type NoteModal =
  | { kind: "reject"; id: string }
  | { kind: "rejectReturn"; id: string }
  | null;

type FilterValue = RmaStatus | "ESCALATED" | "";

function SellerRmaInner() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<FilterValue>("REQUESTED");
  const [noteModal, setNoteModal] = useState<NoteModal>(null);
  const escalatedOnly = filter === "ESCALATED";
  const status = escalatedOnly || !filter ? undefined : filter;
  const { data, isLoading, isError, error } = useShopRma(status, escalatedOnly);
  const action = useShopRmaAction();
  const items = data?.items ?? [];
  const busy = action.isPending;

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">{t("seller.rmaPage.intro")}</p>
      <select
        className="mq-input max-w-[14rem]"
        value={filter}
        aria-label={t("admin.common.filterStatus")}
        onChange={(e) => setFilter(e.target.value as FilterValue)}
      >
        <option value="">{t("admin.common.all")}</option>
        <option value="ESCALATED">{t("seller.rmaPage.escalatedOnly")}</option>
        <option value="REQUESTED">{translateStatus(t, "rma", "REQUESTED")}</option>
        <option value="APPROVED">{translateStatus(t, "rma", "APPROVED")}</option>
        <option value="RETURN_SHIPPED">{translateStatus(t, "rma", "RETURN_SHIPPED")}</option>
        <option value="RETURN_RECEIVED">{translateStatus(t, "rma", "RETURN_RECEIVED")}</option>
        <option value="REFUND_PENDING">{translateStatus(t, "rma", "REFUND_PENDING")}</option>
        <option value="REFUND_SENT">{translateStatus(t, "rma", "REFUND_SENT")}</option>
        <option value="GOODS_RETURN_PENDING">{translateStatus(t, "rma", "GOODS_RETURN_PENDING")}</option>
        <option value="GOODS_RETURN_SHIPPED">{translateStatus(t, "rma", "GOODS_RETURN_SHIPPED")}</option>
        <option value="RETURN_REJECTED">{translateStatus(t, "rma", "RETURN_REJECTED")}</option>
        <option value="DISPUTED">{translateStatus(t, "rma", "DISPUTED")}</option>
        <option value="COMPLETED">{translateStatus(t, "rma", "COMPLETED")}</option>
        <option value="REJECTED">{translateStatus(t, "rma", "REJECTED")}</option>
        <option value="CLOSED">{translateStatus(t, "rma", "CLOSED")}</option>
      </select>

      {isLoading && <OrderListSkeleton />}
      {isError && (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      )}
      {items.length === 0 && !isLoading ? (
        <p className="text-sm text-mq-text-muted">{t("seller.rmaPage.empty")}</p>
      ) : null}

      {items.map((r) => (
        <div key={r.id} className="mq-card p-4 flex flex-wrap justify-between gap-3 text-sm">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/orders/${r.orderId}`} className="font-medium hover:underline">
                {r.orderName ?? r.orderId.slice(0, 8)}
              </Link>
              <span className="mq-badge mq-badge-pink">
                {translateStatus(t, "rma", r.status)}
              </span>
              {r.escalatedAt ? (
                <span className="mq-badge mq-badge-orange">{t("seller.rmaPage.overdue")}</span>
              ) : null}
            </div>
            <p className="text-xs text-mq-text-muted line-clamp-2">{r.reason}</p>
            {r.returnTrackingCode ? (
              <p className="text-xs text-mq-text-muted">
                {t("seller.rmaPage.tracking")}: {r.returnCarrier ? `${r.returnCarrier} · ` : ""}
                {r.returnTrackingCode}
              </p>
            ) : null}
            {r.bankInfo ? (
              <p className="text-xs text-mq-text-muted">
                {r.bankInfo.bankName} · {r.bankInfo.accountNumber} · {r.bankInfo.accountName}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 items-start">
            {isRequested(r.status) ? (
              <>
                <button
                  type="button"
                  className="mq-btn mq-btn-primary text-xs"
                  disabled={busy}
                  onClick={() =>
                    void action.mutateAsync({ id: r.id, action: "approve", orderId: r.orderId })
                  }
                >
                  {t("seller.rmaPage.approve")}
                </button>
                <button
                  type="button"
                  className="mq-btn mq-btn-outline text-xs"
                  disabled={busy}
                  onClick={() => setNoteModal({ kind: "reject", id: r.id })}
                >
                  {t("seller.rmaPage.reject")}
                </button>
              </>
            ) : null}
            {r.status === "RETURN_SHIPPED" ? (
              <button
                type="button"
                className="mq-btn mq-btn-primary text-xs"
                disabled={busy}
                onClick={() =>
                  void action.mutateAsync({
                    id: r.id,
                    action: "returnReceived",
                    orderId: r.orderId,
                  })
                }
              >
                {t("seller.rmaPage.markReceived")}
              </button>
            ) : null}
            {r.status === "RETURN_RECEIVED" ? (
              <>
                <button
                  type="button"
                  className="mq-btn mq-btn-primary text-xs"
                  disabled={busy}
                  onClick={() =>
                    void action.mutateAsync({
                      id: r.id,
                      action: "acceptReturn",
                      orderId: r.orderId,
                    })
                  }
                >
                  {t("seller.rmaPage.acceptReturn")}
                </button>
                <button
                  type="button"
                  className="mq-btn mq-btn-outline text-xs"
                  disabled={busy}
                  onClick={() => setNoteModal({ kind: "rejectReturn", id: r.id })}
                >
                  {t("seller.rmaPage.rejectReturn")}
                </button>
              </>
            ) : null}
            {r.status === "REFUND_PENDING" ? (
              <Link href={`/orders/${r.orderId}`} className="mq-btn mq-btn-primary text-xs">
                {r.refundProofUrl
                  ? t("seller.rmaPage.markRefundSent")
                  : t("seller.rmaPage.uploadRefundProof")}
              </Link>
            ) : null}
            {r.status === "GOODS_RETURN_PENDING" ? (
              <Link href={`/orders/${r.orderId}`} className="mq-btn mq-btn-primary text-xs">
                {t("seller.rmaPage.shipGoodsToBuyer")}
              </Link>
            ) : null}
            {r.status === "GOODS_RETURN_SHIPPED" ? (
              <Link href={`/orders/${r.orderId}`} className="mq-btn mq-btn-primary text-xs">
                {t("seller.rmaPage.updateGoodsReturnTracking")}
              </Link>
            ) : null}
            <Link href={`/orders/${r.orderId}`} className="mq-btn mq-btn-outline text-xs">
              {t("seller.rmaPage.openOrder")}
            </Link>
          </div>
        </div>
      ))}

      <AdminReasonModal
        open={Boolean(noteModal)}
        title={
          noteModal?.kind === "rejectReturn"
            ? t("seller.rmaPage.rejectReturnTitle")
            : t("seller.rmaPage.rejectTitle")
        }
        description={
          noteModal?.kind === "rejectReturn"
            ? t("seller.rmaPage.rejectReturnDesc")
            : t("seller.rmaPage.rejectDesc")
        }
        confirmLabel={t("seller.rmaPage.reject")}
        maxLength={500}
        busy={busy}
        onClose={() => setNoteModal(null)}
        onConfirm={async (note) => {
          if (!noteModal) return;
          await action.mutateAsync({
            id: noteModal.id,
            action: noteModal.kind === "rejectReturn" ? "rejectReturn" : "reject",
            note,
          });
          setNoteModal(null);
        }}
      />
    </div>
  );
}

export default function SellerRmaPage() {
  return (
    <AuthGuard roles={["SELLER", "WAREHOUSE"]}>
      <SellerRmaInner />
    </AuthGuard>
  );
}
