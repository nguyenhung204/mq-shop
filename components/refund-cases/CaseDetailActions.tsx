"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { RefundCaseView } from "@/lib/api/refund-cases";
import { canOverrideCase } from "@/lib/refund-cases/model";

/** Override button of the staff detail: ADMIN / SUPER_ADMIN only AND only when the API lists OVERRIDE. */
export function OverrideButtonView({
  roles,
  c,
  onClick,
}: {
  roles: string[] | undefined;
  c: Pick<RefundCaseView, "actions">;
  onClick: () => void;
}) {
  const { t } = useLanguage();
  if (!canOverrideCase({ roles }, c)) return null;
  return (
    <button type="button" className="mq-admin-btn mq-admin-btn-primary" onClick={onClick}>
      {t("refundCases.action.OVERRIDE")}
    </button>
  );
}

export function CaseDetailActions({ c, onOverride }: { c: Pick<RefundCaseView, "actions">; onOverride: () => void }) {
  const { user } = useAuth();
  return <OverrideButtonView roles={user?.roles} c={c} onClick={onOverride} />;
}
