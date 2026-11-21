"use client";

import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { CaseActionModal } from "@/components/refund-cases/CaseActionModal";
import { CaseCard, type PartyAction } from "@/components/refund-cases/CaseCard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { REFUND_CASE_STATUSES, type RefundCasePage, type RefundCaseView } from "@/lib/api/refund-cases";
import { getErrorMessage } from "@/lib/queries/utils";
import { useRefundCaseAction, useRefundCaseDetail } from "@/lib/queries/refund-cases";
import type { CaseFormKind } from "@/lib/refund-cases/submit";

const FORM_KIND: Record<PartyAction, CaseFormKind> = { MARK_PAID: "markPaid", CONFIRM: "confirm", DISPUTE: "dispute" };

function Row({
  c,
  side,
  busy,
  onAction,
}: {
  c: RefundCaseView;
  side: "buyer" | "seller";
  busy: boolean;
  onAction: (c: RefundCaseView, a: PartyAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const detail = useRefundCaseDetail(c.id, open);
  return (
    <CaseCard
      c={c}
      side={side}
      busy={busy}
      detail={{ data: detail.data, isLoading: detail.isLoading, isError: detail.isError }}
      onExpand={setOpen}
      onAction={(a) => onAction(c, a)}
    />
  );
}

/** Shared list of the buyer's (side "buyer") or the seller's (side "seller") refund cases. */
export function PartyCaseList({
  side,
  list,
  status,
  onStatusChange,
  page,
  onPageChange,
}: {
  side: "buyer" | "seller";
  list: UseQueryResult<RefundCasePage>;
  status: string;
  onStatusChange: (s: string) => void;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const { t } = useLanguage();
  const action = useRefundCaseAction();
  const [modal, setModal] = useState<{ c: RefundCaseView; kind: CaseFormKind } | null>(null);
  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">{t(`refundCases.${side}Page.intro`)}</p>
      <select
        className="mq-input max-w-[16rem]"
        value={status}
        aria-label={t("admin.common.filterStatus")}
        onChange={(e) => {
          onStatusChange(e.target.value);
          onPageChange(1);
        }}
      >
        <option value="">{t("admin.common.all")}</option>
        {REFUND_CASE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`refundCases.status.${s}`)}
          </option>
        ))}
      </select>
      {list.isLoading ? <OrderListSkeleton /> : null}
      {list.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(list.error, t("admin.common.failed"))}</div> : null}
      {!list.isLoading && !list.isError && items.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t(`refundCases.${side}Page.empty`)}</p>
      ) : null}
      {items.map((c) => (
        <Row
          key={c.id}
          c={c}
          side={side}
          busy={action.isPending}
          onAction={(row, a) => setModal({ c: row, kind: FORM_KIND[a] })}
        />
      ))}
      <PaginationBar page={page} meta={list.data?.meta} onPageChange={onPageChange} />
      <CaseActionModal
        open={modal !== null}
        kind={modal?.kind ?? "confirm"}
        caseId={modal?.c.id ?? ""}
        currentStatus={modal?.c.status ?? "OPEN"}
        busy={action.isPending}
        onClose={() => setModal(null)}
        onSubmit={async (s) => {
          if (s.kind === "override") return;
          try {
            await action.mutateAsync(s.vars);
            setModal(null);
          } catch {
            /* toast shown by the hook; the dialog stays open for a retry */
          }
        }}
      />
    </div>
  );
}
