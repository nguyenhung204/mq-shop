"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

/** Subtitle for seller/admin ledger pages — amounts are always TWD. */
export function LedgerTwdNote({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  return (
    <p className={`text-xs text-mq-text-muted ${className}`.trim()}>
      {t("ledger.twdNote")}
    </p>
  );
}
