"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { notificationApi } from "@/lib/api/notifications";
import type { ApiNotification } from "@/lib/api/types";
import { localizeNotification } from "@/lib/notifications/localize";
import { resolveNotificationRoute } from "@/lib/notifications/routes";
import { getErrorMessage } from "@/lib/queries/utils";

const CATEGORIES = [
  "",
  "account",
  "shop",
  "product",
  "order",
  "rma",
  "review",
  "promo",
  "wallet",
  "inventory",
  "commission",
  "mlm",
  "system",
] as const;

const PAGE_SIZE = 20;

function InboxInner() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();
  const { markRead, markAllRead, hide, unreadCount, refresh } = useNotifications();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hideId, setHideId] = useState<string | null>(null);

  const queryKey = useMemo(
    () => ["notifications", "inbox", page, category, unreadOnly] as const,
    [page, category, unreadOnly],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      notificationApi.list({
        page,
        pageSize: PAGE_SIZE,
        category: category || undefined,
        unreadOnly: unreadOnly || undefined,
      }),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  const openItem = async (n: ApiNotification) => {
    if (!n.readAt) {
      try {
        await markRead(n.id);
        void queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
      } catch {
        /* still navigate */
      }
    }
    const href = resolveNotificationRoute(n, { roles: user?.roles ?? [] });
    if (href) router.push(href);
  };

  const onHide = async () => {
    if (!hideId) return;
    try {
      await hide(hideId);
      toast.success(t("notificationsPage.hidden"));
      void queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
      void refresh(1, { quiet: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setHideId(null);
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllRead();
      void queryClient.invalidateQueries({ queryKey: ["notifications", "inbox"] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <>
      <PageHero
        title={t("notificationsPage.title")}
        breadcrumb={[{ label: t("notificationsPage.title") }]}
      />
      <Container className="py-8 md:py-12">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            className="mq-input max-w-xs"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            aria-label={t("notificationsPage.category")}
          >
            {CATEGORIES.map((c) => (
              <option key={c || "all"} value={c}>
                {c
                  ? t(`notificationsPage.categories.${c}`)
                  : t("notificationsPage.allCategories")}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-mq-text-muted">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setPage(1);
              }}
            />
            {t("notificationsPage.unreadOnly")}
          </label>
          <button
            type="button"
            className="mq-btn mq-btn-outline text-xs ml-auto"
            disabled={unreadCount === 0}
            onClick={() => void onMarkAll()}
          >
            <CheckCheck size={14} className="mr-1.5" />
            {t("nav.markAllRead")}
          </button>
        </div>

        {isLoading && items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("nav.notificationsLoading")}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-mq-text-muted">{t("nav.notificationsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-mq-border mq-card overflow-hidden">
            {items.map((n) => {
              const { title, body } = localizeNotification(n, locale);
              return (
                <li key={n.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    {!n.readAt && (
                      <span className="mt-2.5 w-2 h-2 rounded-full bg-mq-gold shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-base font-semibold ${n.readAt ? "text-mq-text-muted" : "text-mq-text"}`}
                      >
                        {title}
                      </p>
                      {body ? (
                        <p className="text-sm text-mq-text-muted mt-1">{body}</p>
                      ) : null}
                      <p className="text-xs text-mq-text-muted mt-2">
                        {n.createdAt
                          ? new Date(n.createdAt).toLocaleString()
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        className="mq-btn mq-btn-primary text-xs !px-3 !py-1.5"
                        onClick={() => void openItem(n)}
                      >
                        {t("nav.notificationsOpen")}
                      </button>
                      <button
                        type="button"
                        className="mq-btn mq-btn-outline text-xs !px-3 !py-1.5"
                        onClick={() => setHideId(n.id)}
                      >
                        <BellOff size={14} />
                        {t("notificationsPage.hide")}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {meta && meta.totalPages > 1 ? (
          <div className="mt-6">
            <PaginationBar page={page} meta={meta} onPageChange={setPage} />
          </div>
        ) : null}
      </Container>

      <ConfirmDialog
        open={Boolean(hideId)}
        title={t("notificationsPage.hideTitle")}
        description={t("notificationsPage.hideDesc")}
        confirmLabel={t("notificationsPage.hide")}
        tone="warn"
        onClose={() => setHideId(null)}
        onConfirm={() => void onHide()}
      />
    </>
  );
}

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <InboxInner />
    </AuthGuard>
  );
}
