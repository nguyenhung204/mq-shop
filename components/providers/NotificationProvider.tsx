"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationApi } from "@/lib/api/notifications";
import { openAuthenticatedSse } from "@/lib/api/sse";
import type { ApiNotification, PageMeta, Role } from "@/lib/api/types";
import { normalizeNotification } from "@/lib/notifications/normalize";
import { localizeNotification } from "@/lib/notifications/localize";
import { resolveNotificationRoute } from "@/lib/notifications/routes";
import { adminWalletKeys, mlmKeys, walletKeys } from "@/lib/queries/wallet";
import { financeKeys } from "@/lib/queries/finance";
import { sellerKeys } from "@/lib/queries/seller";
import { orderKeys } from "@/lib/queries/orders";
import { reviewKeys } from "@/lib/queries/reviews";
import { promotionKeys } from "@/lib/queries/promotions";
import { inventoryKeys } from "@/lib/queries/inventory";
import { settlementKeys } from "@/lib/queries/settlements";
import { adminKeys } from "@/lib/queries/admin";
import { complianceKeys } from "@/lib/queries/compliance";
import { useAuth } from "./AuthProvider";
import { useLanguage } from "./LanguageProvider";

/** Page size for the header dropdown. */
export const NOTIF_PAGE_SIZE = 8;

/** How often to sync inbox while SSE is healthy / unhealthy. */
const POLL_LIVE_MS = 20_000;
const POLL_DEGRADED_MS = 8_000;

type StreamStatus = "idle" | "live" | "reconnecting" | "offline";

type NotificationContextValue = {
  items: ApiNotification[];
  unreadCount: number;
  loading: boolean;
  page: number;
  meta: PageMeta | null;
  streamStatus: StreamStatus;
  refresh: (page?: number, opts?: { quiet?: boolean }) => Promise<void>;
  setPage: (page: number) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clear: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function isCommissionNotify(n: ApiNotification): boolean {
  const type = (n.type || "").toUpperCase();
  if (type.startsWith("COMMISSION_")) return true;
  const title = (n.title || "").toLowerCase();
  return (
    title.includes("commission credited") ||
    title.includes("bonus credited") ||
    title.includes("referral bonus") ||
    title.includes("loyalty bonus") ||
    title.includes("global bonus") ||
    title.includes("team commission") ||
    title.includes("commission not credited")
  );
}

function isRankNotify(n: ApiNotification): boolean {
  const type = (n.type || "").toUpperCase();
  if (type === "MLM_RANK_UPGRADED" || type === "MLM_RANK_UPDATED") return true;
  const title = (n.title || "").toLowerCase();
  return (
    title.includes("mlm rank") ||
    title.includes("rank updated") ||
    title.includes("rank upgraded")
  );
}

/**
 * Push notifications arrive across sessions (e.g. admin approves a seller's
 * shop while the seller has the page open elsewhere) — React Query has no
 * way to know the underlying data changed unless we invalidate on receipt.
 * Without this, the affected page stays stale until a manual reload.
 *
 * Maps each notification type to the query key(s) whose cached data it can
 * make stale. `["queryKeyPrefix"]` invalidates everything under that prefix.
 */
const NOTIFY_INVALIDATION_MAP: Partial<Record<string, readonly (readonly unknown[])[]>> = {
  SHOP_APPROVED: [sellerKeys.all],
  SHOP_REJECTED: [sellerKeys.all],
  SHOP_SUSPENDED: [sellerKeys.all],
  SHOP_REINSTATED: [sellerKeys.all],
  SHOP_BANK_INFO_SETUP: [sellerKeys.all],
  SHOP_BANK_INFO_REMINDER: [sellerKeys.all],
  PRODUCT_APPROVED: [sellerKeys.all],
  PRODUCT_REJECTED: [sellerKeys.all],
  PRODUCT_HIDDEN: [sellerKeys.all],
  ORDER_NEW: [orderKeys.all],
  ORDER_STATUS_UPDATED: [orderKeys.all],
  ORDER_CANCELLED: [orderKeys.all],
  ORDER_CREATED_BY_ADMIN: [orderKeys.all],
  ORDER_CREATED_PAYMENT_NEEDED: [orderKeys.all],
  RMA_NEW: [orderKeys.all],
  RMA_APPROVED: [orderKeys.all],
  RMA_REJECTED: [orderKeys.all],
  RMA_REFUND_COMPLETED: [orderKeys.all],
  RMA_APPROVED_EXTERNAL_REFUND: [orderKeys.all],
  REVIEW_NEW: [reviewKeys.all],
  REVIEW_SELLER_REPLIED: [reviewKeys.all],
  REVIEW_HIDDEN: [reviewKeys.all],
  REVIEW_UNHIDDEN: [reviewKeys.all],
  PROMOTION_APPROVED: [promotionKeys.all],
  PROMOTION_REJECTED: [promotionKeys.all],
  INVENTORY_SLIP_PENDING: [inventoryKeys.all],
  INVENTORY_SLIP_APPROVED: [inventoryKeys.all],
  INVENTORY_SLIP_REJECTED: [inventoryKeys.all],
  INVENTORY_TRANSFER_PENDING: [inventoryKeys.all],
  INVENTORY_TRANSFER_APPROVED: [inventoryKeys.all],
  INVENTORY_TRANSFER_RECEIVED: [inventoryKeys.all],
  // SELLER_PAYOUT_* — seller's own settlement view + accountant's payout queue.
  SELLER_PAYOUT_COMPLETED: [walletKeys.all, settlementKeys.all, financeKeys.all],
  SELLER_PAYOUT_REJECTED: [walletKeys.all, settlementKeys.all, financeKeys.all],
  WALLET_PIN_UPDATED: [walletKeys.all],
  WALLET_TRANSFER_SENT: [walletKeys.all],
  WALLET_TRANSFER_RECEIVED: [walletKeys.all],
  WALLET_ADJUSTED: [walletKeys.all],
  WALLET_WITHDRAW_REQUESTED: [walletKeys.all],
  WALLET_WITHDRAW_APPROVED: [walletKeys.all],
  WALLET_WITHDRAW_REJECTED: [walletKeys.all],
  WALLET_WITHDRAW_COMPLETED: [walletKeys.all],
  WALLET_WITHDRAW_PAY_FAILED: [walletKeys.all],
  // Sent to the ACCOUNTANT approving the withdrawal — needs the admin queue, not
  // the requester's own wallet.
  WALLET_WITHDRAW_NEW: [adminWalletKeys.all],
  WALLET_WITHDRAW_STAFF_APPROVED: [adminWalletKeys.all],
  WALLET_WITHDRAW_STAFF_REJECTED: [adminWalletKeys.all],
  WALLET_WITHDRAW_STAFF_PROCESSED: [adminWalletKeys.all],
  WALLET_WITHDRAW_STAFF_PAY_FAILED: [adminWalletKeys.all],
  MLM_REFERRER_UPDATED: [mlmKeys.all],
  MLM_DOWNLINE_ASSIGNED: [mlmKeys.all],
  MLM_REFERRAL_RATE_UPDATED: [mlmKeys.all],
  STAFF_ROLE_ASSIGNED: [adminKeys.staff(), sellerKeys.all],
  PLATFORM_ADMIN_ACCOUNT: [adminKeys.platformStaff()],
  DSAR_REQUEST_NEW: [complianceKeys.dsar()],
  REFERRAL_DOWNLINE_JOINED: [mlmKeys.all],
  SHOP_APPLICATION_NEW: [["admin", "shops"]],
  ACCOUNT_LOCKED: [["admin", "users"]],
  ACCOUNT_UNLOCKED: [["admin", "users"]],
  ACCOUNT_DELETED: [["admin", "users"]],
  COMMISSION_JOB_FAILED: [["admin", "dashboard"]],
};

function applyIncoming(
  incoming: ApiNotification,
  page: number,
  setItems: Dispatch<SetStateAction<ApiNotification[]>>,
  setUnreadCount: Dispatch<SetStateAction<number>>,
  setMeta: Dispatch<SetStateAction<PageMeta | null>>,
) {
  if (!incoming.readAt) setUnreadCount((c) => c + 1);

  // Always keep newest on page 1 inbox so the bell list stays fresh even if closed.
  if (page === 1) {
    setItems((prev) =>
      [incoming, ...prev.filter((x) => x.id !== incoming.id)].slice(0, NOTIF_PAGE_SIZE),
    );
    setMeta((prev) =>
      prev
        ? {
            ...prev,
            total: prev.total + 1,
            totalPages: Math.max(
              1,
              Math.ceil((prev.total + 1) / (prev.pageSize || NOTIF_PAGE_SIZE)),
            ),
          }
        : prev,
    );
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const { isAuthenticated, loading: authLoading, refreshUser, user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPageState] = useState(1);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const seenIds = useRef<Set<string>>(new Set());
  const itemsRef = useRef(items);
  const pageRef = useRef(page);
  const rolesRef = useRef<Role[]>(user?.roles ?? []);
  const handleRealtimeRef = useRef<(raw: unknown, opts?: { toast?: boolean }) => void>(
    () => undefined,
  );
  const refreshRef = useRef<(page?: number, opts?: { quiet?: boolean }) => Promise<void>>(
    async () => undefined,
  );

  itemsRef.current = items;
  pageRef.current = page;
  rolesRef.current = user?.roles ?? [];

  const announce = useCallback(
    (incoming: ApiNotification) => {
      if (isCommissionNotify(incoming)) {
        void queryClient.invalidateQueries({ queryKey: walletKeys.all });
        void queryClient.invalidateQueries({ queryKey: mlmKeys.all });
      }
      if (isRankNotify(incoming)) {
        void refreshUser();
        void queryClient.invalidateQueries({ queryKey: mlmKeys.rankProgress() });
        void queryClient.invalidateQueries({ queryKey: mlmKeys.all });
      }
      const invalidateKeys = NOTIFY_INVALIDATION_MAP[(incoming.type || "").toUpperCase()];
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }

      const href = resolveNotificationRoute(incoming, {
        roles: rolesRef.current,
      });
      const { title, body } = localizeNotification(incoming, locale);
      toast.info(title || t("nav.notifications"), {
        description: body || undefined,
        duration: 6000,
        action: href
          ? {
              label: t("nav.notificationsOpen"),
              onClick: () => {
                router.push(href);
              },
            }
          : undefined,
      });
    },
    [queryClient, refreshUser, router, t, locale],
  );

  const handleRealtime = useCallback(
    (raw: unknown, opts?: { toast?: boolean }) => {
      const n = normalizeNotification(raw);
      if (!n?.id) return;
      if (seenIds.current.has(n.id)) return;
      seenIds.current.add(n.id);

      const incoming: ApiNotification = { ...n, readAt: n.readAt ?? null };
      applyIncoming(incoming, pageRef.current, setItems, setUnreadCount, setMeta);

      if (opts?.toast !== false) announce(incoming);
    },
    [announce],
  );
  handleRealtimeRef.current = handleRealtime;

  const refresh = useCallback(
    async (nextPage?: number, opts?: { quiet?: boolean }) => {
      if (!isAuthenticated) return;
      const target = nextPage ?? pageRef.current;
      if (!opts?.quiet) setLoading(true);
      try {
        const result = await notificationApi.list({
          page: target,
          pageSize: NOTIF_PAGE_SIZE,
        });
        const normalized = result.items
          .map((row) => normalizeNotification(row))
          .filter((row): row is ApiNotification => Boolean(row));

        // Toast only truly new rows (arrived since last sync), not the initial hydrate.
        const isHydrate = seenIds.current.size === 0;
        for (const n of normalized) {
          if (seenIds.current.has(n.id)) continue;
          seenIds.current.add(n.id);
          if (!isHydrate && !n.readAt && opts?.quiet) {
            announce(n);
          }
        }

        setUnreadCount(result.unreadCount);
        setMeta(result.meta ?? null);
        setPageState(result.meta?.page ?? target);
        if (target === 1 || pageRef.current === target) {
          setItems(normalized);
        }
      } catch {
        /* keep current inbox on transient failure */
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [announce, isAuthenticated],
  );
  refreshRef.current = refresh;

  const setPage = useCallback(
    (next: number) => {
      setPageState(next);
      void refresh(next);
    },
    [refresh],
  );

  // REST history on login
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      setMeta(null);
      setPageState(1);
      seenIds.current.clear();
      setStreamStatus("idle");
      return;
    }
    void refresh(1);
  }, [authLoading, isAuthenticated, refresh]);

  // Authenticated SSE — stable effect (handlers via refs) so the socket does not flap.
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const ac = new AbortController();
    setStreamStatus("reconnecting");
    let wasLive = false;

    void openAuthenticatedSse(
      "/notifications/stream",
      {
        onOpen: () => {
          setStreamStatus("live");
          if (wasLive) void refreshRef.current(1, { quiet: true });
          wasLive = true;
        },
        onMessage: (raw) => {
          try {
            const parsed = JSON.parse(raw) as unknown;
            const payload =
              parsed &&
              typeof parsed === "object" &&
              "data" in (parsed as object) &&
              !("id" in (parsed as object))
                ? (parsed as { data: unknown }).data
                : parsed;
            handleRealtimeRef.current(payload, { toast: true });
          } catch {
            /* ignore malformed payload */
          }
        },
        onError: () => {
          if (!ac.signal.aborted) setStreamStatus("reconnecting");
        },
      },
      ac.signal,
    ).catch(() => {
      if (!ac.signal.aborted) setStreamStatus("offline");
    });

    return () => {
      ac.abort();
      setStreamStatus("idle");
    };
  }, [isAuthenticated, authLoading]);

  // Polling fallback — badge + toast even when SSE is down / buffered.
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    const tick = () => {
      void refreshRef.current(1, { quiet: true });
    };

    const ms = streamStatus === "live" ? POLL_LIVE_MS : POLL_DEGRADED_MS;
    const timer = setInterval(tick, ms);
    // Immediate quiet sync shortly after mount / stream health change.
    const kickoff = setTimeout(tick, 1_500);

    return () => {
      clearInterval(timer);
      clearTimeout(kickoff);
    };
  }, [isAuthenticated, authLoading, streamStatus]);

  // Catch-up when tab becomes visible again.
  useEffect(() => {
    if (!isAuthenticated) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshRef.current(1, { quiet: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [isAuthenticated]);

  const markRead = useCallback(async (id: string) => {
    const target = itemsRef.current.find((n) => n.id === id);
    if (!target || target.readAt) return;

    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: now } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await notificationApi.markRead(id);
    } catch {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: target.readAt } : n)));
      setUnreadCount((c) => c + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    const snapshot = itemsRef.current;
    const prevUnread = unreadCount;

    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);

    try {
      await notificationApi.markAllRead();
    } catch {
      setItems(snapshot);
      setUnreadCount(prevUnread);
    }
  }, [unreadCount]);

  const clear = useCallback(() => {
    setItems([]);
    setUnreadCount(0);
    setMeta(null);
    setPageState(1);
    seenIds.current.clear();
  }, []);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      page,
      meta,
      streamStatus,
      refresh,
      setPage,
      markRead,
      markAllRead,
      clear,
    }),
    [
      items,
      unreadCount,
      loading,
      page,
      meta,
      streamStatus,
      refresh,
      setPage,
      markRead,
      markAllRead,
      clear,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
