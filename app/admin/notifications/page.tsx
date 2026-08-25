"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PaginationBar } from "@/components/ui/PaginationBar";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/SearchableSelect";
import { AdminCardListSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { adminApi } from "@/lib/api";
import {
  adminNotificationApi,
  type AdminCatalogItem,
  type AdminNotificationTarget,
  type AdminSentNotification,
} from "@/lib/api/notifications";
import type { AuthUser, Role } from "@/lib/api/types";
import { parsePage } from "@/lib/api/utils";
import { getErrorMessage } from "@/lib/queries/utils";

const TABS = ["compose", "sent", "catalog"] as const;
type TabId = (typeof TABS)[number];

const BROADCAST_TYPES = [
  "SYSTEM_ANNOUNCEMENT",
  "SYSTEM_MAINTENANCE",
  "ADMIN_BROADCAST",
  "GENERIC",
] as const;

const CATALOG_GROUPS = [
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

const ROLES: Role[] = [
  "BUYER",
  "SELLER",
  "WAREHOUSE",
  "CS",
  "ACCOUNTANT",
  "ADMIN",
  "SUPER_ADMIN",
];

type Audience = "ALL" | "ROLE" | "USER";

function isCatalogPlaceholder(text: string | null | undefined): boolean {
  const s = (text ?? "").trim();
  return !s || /^\{[a-zA-Z0-9_]+\}$/.test(s);
}

function catalogRowDescription(
  item: AdminCatalogItem,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  const typeKey = `admin.notifications.types.${item.type}`;
  const typeLabel = t(typeKey);
  const localizedType = typeLabel !== typeKey ? typeLabel : "";
  const descKey = `admin.notifications.catalogTypeDesc.${item.type}`;
  const typeDesc = t(descKey);
  const localizedDesc = typeDesc !== descKey ? typeDesc : "";
  const title = isCatalogPlaceholder(item.title) ? "" : item.title.trim();
  const actorText = [
    ...item.actors,
    ...item.shopRoles.map((r) => t("admin.notifications.shopRole", { role: r })),
  ].join(", ");
  const parts = [
    localizedDesc || localizedType || title,
    item.mode === "broadcast" && !localizedDesc
      ? t("admin.notifications.catalogBroadcastHint")
      : "",
    item.mode !== "broadcast" ? actorText : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function parseTab(raw: string | null): TabId {
  if (raw === "sent" || raw === "catalog" || raw === "compose") return raw;
  return "compose";
}

function userLabel(u: AuthUser): string {
  const name = u.fullName?.trim();
  if (name) return `${name} · ${u.email}`;
  return u.email;
}

function targetLabel(
  t: (key: string, vars?: Record<string, string>) => string,
  n: AdminSentNotification,
): string {
  const types = n.targets ?? [];
  if (types.some((x) => x.type === "ALL")) return t("admin.notifications.audienceAll");
  const roles = types.filter((x) => x.type === "ROLE").map((x) => x.value).filter(Boolean);
  const users = types.filter((x) => x.type === "USER");
  if (roles.length) {
    return t("admin.notifications.audienceRoles", { roles: roles.join(", ") });
  }
  if (users.length) {
    return t("admin.notifications.audienceUsers", { count: String(users.length) });
  }
  return "—";
}

function ComposePanel({ onSent }: { onSent: () => void }) {
  const { t } = useLanguage();
  const [type, setType] = useState<(typeof BROADCAST_TYPES)[number]>(
    "SYSTEM_ANNOUNCEMENT",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [roles, setRoles] = useState<Role[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [picked, setPicked] = useState<AuthUser[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const usersQ = useQuery({
    queryKey: ["admin", "users", "ACTIVE", "notify-picker"],
    enabled: audience === "USER",
    queryFn: async () =>
      parsePage<AuthUser>(
        await adminApi.users({ status: "ACTIVE", page: 1, pageSize: 100 }),
      ),
  });

  const searchQ = useQuery({
    queryKey: ["admin", "users", "notify-search", userQuery],
    enabled: audience === "USER" && userQuery.trim().length >= 2,
    queryFn: async () =>
      parsePage<AuthUser>(
        await adminApi.users({
          page: 1,
          pageSize: 20,
          q: userQuery.trim(),
        }),
      ),
  });

  const usersById = useMemo(() => {
    const map = new Map<string, AuthUser>();
    for (const u of usersQ.data?.items ?? []) map.set(u.id, u);
    for (const u of searchQ.data?.items ?? []) map.set(u.id, u);
    return map;
  }, [searchQ.data?.items, usersQ.data?.items]);

  const userOptions = useMemo<SearchableSelectOption[]>(() => {
    const pickedIds = new Set(picked.map((p) => p.id));
    return [...usersById.values()]
      .filter((u) => !pickedIds.has(u.id))
      .sort((a, b) =>
        userLabel(a).localeCompare(userLabel(b), undefined, { sensitivity: "base" }),
      )
      .map((u) => ({
        value: u.id,
        label: userLabel(u),
        keywords: `${u.fullName ?? ""} ${u.email} ${u.phone ?? ""} ${u.id}`,
      }));
  }, [picked, usersById]);

  const targets = useMemo((): AdminNotificationTarget[] => {
    if (audience === "ALL") return [{ type: "ALL" }];
    if (audience === "ROLE") {
      return roles.map((role) => ({ type: "ROLE" as const, value: role }));
    }
    return picked.map((u) => ({ type: "USER" as const, value: u.id }));
  }, [audience, roles, picked]);

  const create = useMutation({
    mutationFn: () =>
      adminNotificationApi.create({
        type,
        title: title.trim(),
        body: body.trim(),
        targets,
      }),
    onSuccess: () => {
      toast.success(t("admin.notifications.sent"));
      setTitle("");
      setBody("");
      setPicked([]);
      setUserQuery("");
      onSent();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || targets.length === 0) {
      toast.error(t("admin.notifications.invalid"));
      return;
    }
    try {
      const countRes = await adminNotificationApi.recipientCount(
        audience === "ALL"
          ? { all: true }
          : audience === "ROLE"
            ? { roles: roles.join(",") }
            : { userIds: picked.map((u) => u.id).join(",") },
      );
      const count = countRes.count ?? 0;
      setPendingCount(count);
      if (count > 50) {
        setConfirmOpen(true);
        return;
      }
      await create.mutateAsync();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleRole = (role: Role) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  return (
    <>
      <form className="mq-card p-5 space-y-4 max-w-2xl" onSubmit={(e) => void onSubmit(e)}>
        <p className="text-sm text-mq-text-muted">{t("admin.notifications.composeDesc")}</p>
        <label className="block text-sm">
          <span className="text-mq-text-muted">{t("admin.notifications.type")}</span>
          <select
            className="mq-input mt-1"
            value={type}
            onChange={(e) =>
              setType(e.target.value as (typeof BROADCAST_TYPES)[number])
            }
          >
            {BROADCAST_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`admin.notifications.types.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-mq-text-muted">{t("admin.notifications.title")}</span>
          <input
            className="mq-input mt-1"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-mq-text-muted">{t("admin.notifications.body")}</span>
          <textarea
            className="mq-input mt-1 min-h-32"
            value={body}
            maxLength={4000}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm text-mq-text-muted">
            {t("admin.notifications.audience")}
          </legend>
          {(["ALL", "ROLE", "USER"] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="audience"
                checked={audience === mode}
                onChange={() => setAudience(mode)}
              />
              {t(
                `admin.notifications.audience${mode === "ALL" ? "All" : mode === "ROLE" ? "Role" : "User"}`,
              )}
            </label>
          ))}
        </fieldset>

        {audience === "ROLE" && (
          <div className="flex flex-wrap gap-3">
            {ROLES.map((role) => (
              <label key={role} className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {role}
              </label>
            ))}
          </div>
        )}

        {audience === "USER" && (
          <div className="space-y-2 min-w-0">
            <label className="block text-sm min-w-0">
              <span className="text-xs text-mq-text-muted">
                {t("admin.notifications.searchUser")}
              </span>
              <div className="mt-1 min-w-0">
                <SearchableSelect
                  options={userOptions}
                  value=""
                  aria-label={t("admin.notifications.searchUser")}
                  placeholder={t("admin.notifications.searchUserPh")}
                  searchPlaceholder={t("admin.notifications.searchUserPh")}
                  emptyText={t("admin.notifications.searchUserEmpty")}
                  onQueryChange={setUserQuery}
                  onChange={(id) => {
                    const u = usersById.get(id);
                    if (!u) return;
                    setPicked((prev) =>
                      prev.some((p) => p.id === u.id) ? prev : [...prev, u],
                    );
                  }}
                />
              </div>
            </label>
            {picked.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {picked.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="mq-badge mq-badge-muted"
                    onClick={() =>
                      setPicked((prev) => prev.filter((p) => p.id !== u.id))
                    }
                  >
                    {userLabel(u)} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <button
          type="submit"
          className="mq-admin-btn mq-admin-btn-approve"
          disabled={create.isPending}
        >
          {create.isPending ? t("admin.common.working") : t("admin.notifications.send")}
        </button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title={t("admin.notifications.confirmTitle")}
        description={t("admin.notifications.confirmDesc", {
          count: String(pendingCount),
        })}
        confirmLabel={t("admin.notifications.send")}
        tone="warn"
        busy={create.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await create.mutateAsync();
          setConfirmOpen(false);
        }}
      />
    </>
  );
}

function SentPanel({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "notifications", "sent", page],
    enabled: active,
    queryFn: async () =>
      parsePage<AdminSentNotification>(
        await adminNotificationApi.list({ page, pageSize: 20 }),
      ),
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  if (isLoading) return <TableSkeleton rows={6} />;
  if (items.length === 0) {
    return (
      <p className="text-sm text-mq-text-muted">{t("admin.notifications.historyEmpty")}</p>
    );
  }

  return (
    <>
      <div className="mq-table-wrap">
        <table className="w-full text-sm">
          <thead className="bg-mq-surface-subtle text-left">
            <tr>
              <th className="p-3">{t("admin.notifications.colTitle")}</th>
              <th className="p-3">{t("admin.notifications.colAudience")}</th>
              <th className="p-3">{t("admin.notifications.colRecipients")}</th>
              <th className="p-3">{t("admin.notifications.colDate")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id} className="border-t border-mq-border">
                <td className="p-3">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-mq-text-muted mt-0.5">{n.type}</div>
                </td>
                <td className="p-3">{targetLabel(t, n)}</td>
                <td className="p-3">{n.recipientCount ?? "—"}</td>
                <td className="p-3 whitespace-nowrap text-sm text-mq-text-muted">
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} meta={meta} onPageChange={setPage} />
    </>
  );
}

function CatalogPanel({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "notifications", "catalog"],
    enabled: active,
    queryFn: () => adminNotificationApi.catalog(),
  });

  const items = data?.items ?? [];
  const allRoles = (data?.roles?.length ? data.roles : ROLES) as Role[];
  const roles = roleFilter
    ? allRoles.filter((role) => role === roleFilter)
    : allRoles;

  const roleLabel = (role: string) => {
    const key = `admin.rbac.roles.${role}`;
    const label = t(key);
    return label === key ? role : label;
  };

  const categoryLabel = (category: string) => {
    const key = `admin.notifications.categories.${category}`;
    const label = t(key);
    return label === key ? category : label;
  };

  const matrixRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (!q) return true;
      const hay = [
        item.type,
        item.title,
        item.body,
        item.source,
        item.mode,
        ...item.actors,
        ...item.shopRoles,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    const remaining = new Set(filtered);
    const rows: Array<
      | { type: "header"; category: string }
      | { type: "item"; item: AdminCatalogItem }
    > = [];
    const ordered = [
      ...CATALOG_GROUPS.filter(
        (g) => !categoryFilter || categoryFilter === g,
      ),
      ...Array.from(
        new Set(filtered.map((i) => i.category).filter(Boolean)),
      ).filter((g) => !CATALOG_GROUPS.includes(g as (typeof CATALOG_GROUPS)[number])),
    ];
    for (const category of ordered) {
      const inGroup = filtered.filter((i) => i.category === category);
      if (!inGroup.length) continue;
      rows.push({ type: "header", category });
      for (const item of inGroup) {
        rows.push({ type: "item", item });
        remaining.delete(item);
      }
    }
    for (const item of filtered) {
      if (remaining.has(item)) rows.push({ type: "item", item });
    }
    return rows;
  }, [items, search, categoryFilter]);

  if (isLoading) return <TableSkeleton rows={10} />;

  const categories = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean)),
  ).sort((a, b) => {
    const rank = (g: string) => {
      const i = CATALOG_GROUPS.indexOf(g as (typeof CATALOG_GROUPS)[number]);
      return i === -1 ? CATALOG_GROUPS.length : i;
    };
    return rank(a) - rank(b);
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-mq-text-muted">{t("admin.notifications.catalogDesc")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-mq-text-muted min-w-[12rem] flex-1">
          {t("admin.notifications.catalogSearch")}
          <input
            type="search"
            className="mq-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.notifications.catalogSearchPlaceholder")}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-mq-text-muted min-w-[10rem]">
          {t("admin.notifications.catalogFilterRole")}
          <select
            className="mq-input mq-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">{t("admin.notifications.catalogAllRoles")}</option>
            {allRoles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-mq-text-muted min-w-[12rem]">
          {t("admin.notifications.catalogFilterCategory")}
          <select
            className="mq-input mq-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">{t("admin.notifications.catalogAllCategories")}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mq-table-wrap mq-rbac-matrix-wrap">
        <table className="mq-rbac-matrix-table">
          <thead>
            <tr>
              <th className="mq-rbac-sticky-col">{t("admin.notifications.colType")}</th>
              {roles.map((role) => (
                <th key={role} title={role}>
                  {roleLabel(role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixRows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, roles.length) + 1}
                  className="p-4 text-center text-mq-text-muted text-sm"
                >
                  {t("admin.notifications.catalogEmptyFilter")}
                </td>
              </tr>
            ) : (
              matrixRows.map((row) => {
                if (row.type === "header") {
                  return (
                    <tr key={`g-${row.category}`} className="mq-rbac-group-row">
                      <th
                        className="mq-rbac-sticky-col mq-rbac-group-head"
                        scope="colgroup"
                        colSpan={Math.max(1, roles.length) + 1}
                      >
                        {categoryLabel(row.category)}
                      </th>
                    </tr>
                  );
                }
                const item = row.item;
                const granted = new Set(
                  item.roles.filter((r) => r.granted).map((r) => r.role),
                );
                const shopRoles = new Set(item.shopRoles);
                const desc = catalogRowDescription(item, t);
                return (
                  <tr key={item.type}>
                    <th className="mq-rbac-sticky-col" scope="row" title={desc}>
                      <span className="mq-rbac-perm-code">{item.type}</span>
                      <span className="mq-rbac-perm-desc">{desc || "—"}</span>
                    </th>
                    {roles.map((role) => {
                      const platform = granted.has(role);
                      const shop = shopRoles.has(role);
                      if (!platform && !shop) {
                        return (
                          <td key={role} className="mq-rbac-cell">
                            —
                          </td>
                        );
                      }
                      const locked = item.locked;
                      return (
                        <td
                          key={role}
                          className={["mq-rbac-cell", shop && !platform ? "is-overridden" : ""]
                            .filter(Boolean)
                            .join(" ")}
                          title={
                            shop && !platform
                              ? t("admin.notifications.shopRole", { role })
                              : locked
                                ? t("admin.notifications.modeSystem")
                                : t("admin.notifications.modeBroadcast")
                          }
                        >
                          {locked ? (
                            <Lock
                              className="inline-block size-3.5 text-mq-text-muted"
                              aria-label={t("admin.notifications.modeSystem")}
                            />
                          ) : (
                            <Check
                              className="inline-block size-3.5 text-mq-gold"
                              aria-label={t("admin.notifications.modeBroadcast")}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotificationsInner() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const tab = parseTab(searchParams.get("tab"));

  const setTab = (id: TabId) => {
    router.replace(`/admin/notifications?tab=${id}`, { scroll: false });
  };

  const tabLabel = (id: TabId) => {
    if (id === "compose") return t("admin.notifications.tabCompose");
    if (id === "sent") return t("admin.notifications.tabSent");
    return t("admin.notifications.tabCatalog");
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.notifications.pageTitle")}
        description={t("admin.notifications.pageDesc")}
      />

      <div className="space-y-5">
        <div
          className="flex flex-wrap gap-1 border-b border-mq-border pb-px"
          role="tablist"
          aria-label={t("admin.notifications.pageTitle")}
        >
          {TABS.map((id) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`px-3.5 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  active
                    ? "bg-mq-surface text-mq-text border border-mq-border border-b-mq-surface -mb-px"
                    : "text-mq-text-muted hover:text-mq-text"
                }`}
                onClick={() => setTab(id)}
              >
                {tabLabel(id)}
              </button>
            );
          })}
        </div>

        <div role="tabpanel">
          <div hidden={tab !== "compose"}>
            <ComposePanel
              onSent={() => {
                void queryClient.invalidateQueries({
                  queryKey: ["admin", "notifications", "sent"],
                });
                setTab("sent");
              }}
            />
          </div>
          <div hidden={tab !== "sent"}>
            <SentPanel active={tab === "sent"} />
          </div>
          <div hidden={tab !== "catalog"}>
            <CatalogPanel active={tab === "catalog"} />
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminNotificationsPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["SEND_NOTIFICATION"]}>
      <Suspense fallback={<AdminCardListSkeleton count={4} />}>
        <NotificationsInner />
      </Suspense>
    </AuthGuard>
  );
}
