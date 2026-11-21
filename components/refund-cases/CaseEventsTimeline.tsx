"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import type { RefundCaseEvent } from "@/lib/api/refund-cases";
import { formatDateTimeGmt8 } from "@/lib/i18n/gmt8-calendar";
import { toIntlLocale } from "@/lib/i18n/locale-format";
import { eventText } from "@/lib/refund-cases/model";

/**
 * Event history of a case. `viewer="party"` (buyer, seller): the free text of an admin override and of
 * support's RMA sync is replaced by the fixed line "Updated by support"; staff see the real text and actor.
 */
export function CaseEventsTimeline({ events, viewer }: { events: RefundCaseEvent[]; viewer: "party" | "staff" }) {
  const { t, locale } = useLanguage();
  const intl = toIntlLocale(locale);
  if (events.length === 0) return <p className="text-xs text-mq-text-muted">{t("refundCases.events.empty")}</p>;
  return (
    <ol className="space-y-2 text-xs">
      {events.map((e) => {
        const text = eventText(e, viewer);
        return (
          <li key={e.seq} className="border-t border-mq-border pt-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{t(`refundCases.event.${e.kind}`)}</span>
              <span className="text-mq-text-muted whitespace-nowrap">{formatDateTimeGmt8(e.at, intl)}</span>
              <span className="mq-badge mq-badge-muted">{t(`refundCases.actor.${e.actorRole}`)}</span>
              {e.onBehalfOf ? (
                <span className="text-mq-text-muted">{t("refundCases.events.onBehalf", { who: t(`refundCases.actor.${e.onBehalfOf}`) })}</span>
              ) : null}
            </div>
            <p className="text-mq-text-muted">
              {e.from ? `${t(`refundCases.status.${e.from}`)} → ` : ""}
              {t(`refundCases.status.${e.to}`)}
            </p>
            {viewer === "staff" && (e.actorName || e.actorEmail) ? (
              <p className="text-mq-text-muted">{[e.actorName, e.actorEmail].filter(Boolean).join(" · ")}</p>
            ) : null}
            {text.type === "support" ? (
              <p className="italic">{t("refundCases.updatedBySupport")}</p>
            ) : (
              <>
                {text.note ? <p>{text.note}</p> : null}
                {text.reference ? (
                  <p className="text-mq-text-muted">
                    {t("refundCases.reference")}: {text.reference}
                  </p>
                ) : null}
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
