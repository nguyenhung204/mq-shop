"use client";

import type { ProofRetentionView } from "@/lib/api/orders";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ProofRetentionBadge({
  retention,
  compact = false,
}: {
  retention?: ProofRetentionView | null;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  if (!retention || retention.status === "none" || retention.status === "live") {
    return null;
  }
  if (retention.status === "purged") {
    return (
      <span className={compact ? "mq-badge mq-badge-orange text-[10px]" : "mq-badge mq-badge-orange"}>
        {t("orders.payment.retentionBadgePurged")}
      </span>
    );
  }
  return (
    <span className={compact ? "mq-badge mq-badge-orange text-[10px]" : "mq-badge mq-badge-orange"}>
      {t("orders.payment.retentionBadgeNotice")}
    </span>
  );
}

export function ProofRetentionNotice({
  retention,
}: {
  retention?: ProofRetentionView | null;
}) {
  const { t } = useLanguage();
  if (!retention) return null;
  if (retention.status === "purged") {
    return (
      <p className="text-xs text-mq-text-muted">{t("orders.payment.purgedPlaceholder")}</p>
    );
  }
  if (retention.status === "notice") {
    return (
      <p className="text-xs text-mq-accent-orange">
        {t("orders.payment.retentionNotice", {
          days: String(retention.daysUntilDelete ?? 0),
        })}
      </p>
    );
  }
  return null;
}

export function ProofFilePreview({
  url,
  alt,
  retention,
  imgClassName,
}: {
  url?: string | null;
  alt: string;
  retention?: ProofRetentionView | null;
  imgClassName?: string;
}) {
  const { t } = useLanguage();

  if (retention?.status === "purged") {
    return (
      <div className="space-y-1">
        <ProofRetentionBadge retention={retention} />
        <p className="text-sm text-mq-text-muted">{t("orders.payment.purgedPlaceholder")}</p>
      </div>
    );
  }

  if (!url) return null;

  return (
    <div className="space-y-2">
      <ProofRetentionBadge retention={retention} />
      <ProofRetentionNotice retention={retention} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className={
          imgClassName ??
          "max-h-48 w-auto rounded border border-mq-border object-contain bg-white"
        }
      />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs underline text-mq-text-secondary"
      >
        {t("orders.payment.downloadProof")}
      </a>
    </div>
  );
}
