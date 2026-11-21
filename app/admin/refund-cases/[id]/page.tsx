"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminCaseDetailView } from "@/components/refund-cases/AdminCaseViews";
import { CaseActionModal } from "@/components/refund-cases/CaseActionModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";
import { useAdminRefundCaseDetail, useOverrideRefundCase } from "@/lib/queries/refund-cases";
import { getErrorMessage } from "@/lib/queries/utils";
import { canDo } from "@/lib/refund-cases/model";

function CaseDetailInner({ id }: { id: string }) {
  const { t } = useLanguage();
  const { data, isLoading, isError, error } = useAdminRefundCaseDetail(id);
  const override = useOverrideRefundCase();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdminPageHeader
        title={data?.orderCode ? `${t("refundCases.admin.detailTitle")} · ${data.orderCode}` : t("refundCases.admin.detailTitle")}
        actions={
          <>
            <Link href="/admin/refund-cases" className="mq-admin-btn mq-admin-btn-secondary">
              <ArrowLeft size={16} aria-hidden />
              {t("refundCases.admin.back")}
            </Link>
            {data && canDo(data, "OVERRIDE") ? (
              <button type="button" className="mq-admin-btn mq-admin-btn-primary" onClick={() => setOpen(true)}>
                {t("refundCases.action.OVERRIDE")}
              </button>
            ) : null}
          </>
        }
      />
      {isLoading ? <AdminCardListSkeleton count={2} /> : null}
      {isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(error, t("admin.common.failed"))}</div> : null}
      {data ? <AdminCaseDetailView c={data} /> : null}
      <CaseActionModal
        open={open && data != null}
        kind="override"
        caseId={id}
        currentStatus={data?.status ?? "OPEN"}
        busy={override.isPending}
        onClose={() => setOpen(false)}
        onSubmit={async (s) => {
          if (s.kind !== "override") return;
          try {
            await override.mutateAsync(s.vars);
            setOpen(false);
          } catch {
            /* toast shown by the hook; keep the dialog open for a retry */
          }
        }}
      />
    </>
  );
}

export default function AdminRefundCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["CS", "ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]} permissions={["VIEW_REFUND_CASES"]}>
      <CaseDetailInner id={id} />
    </AuthGuard>
  );
}
