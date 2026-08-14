"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw, Save } from "lucide-react";
import {
  isRbacLockoutCell,
  rbacCellKey,
  type PermissionScope,
  type RbacMatrixCell,
  type RbacOverrideCellInput,
  type RbacPermission,
  type RbacRole,
} from "@/lib/api/rbac";
import {
  businessGroupOptions,
  isMatrixUiPermission,
  permissionMatchesGroupFilter,
  RBAC_PERMISSION_GROUPS,
  type RbacGroupFilter,
  type RbacPermissionGroupId,
} from "@/lib/api/rbac-groups";
import {
  usePutRbacOverrides,
  useRbacMatrix,
  useRbacOverrides,
  useResetRbacMatrix,
} from "@/lib/queries/rbac";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/queries/utils";

const FALLBACK_SCOPES: PermissionScope[] = ["NONE", "APPROVE", "SELF", "SHOP", "ALL"];

function buildDraftMap(cells: RbacMatrixCell[]): Record<string, PermissionScope> {
  const map: Record<string, PermissionScope> = {};
  for (const cell of cells) {
    map[rbacCellKey(cell.role, cell.permission)] = cell.scope;
  }
  return map;
}

function buildDiff(
  cells: RbacMatrixCell[],
  draft: Record<string, PermissionScope>,
): RbacOverrideCellInput[] {
  const out: RbacOverrideCellInput[] = [];
  for (const cell of cells) {
    const key = rbacCellKey(cell.role, cell.permission);
    const next = draft[key];
    if (next === undefined || next === cell.scope) continue;
    if (next === cell.defaultScope) {
      out.push({ role: cell.role, permission: cell.permission, clear: true });
    } else {
      out.push({ role: cell.role, permission: cell.permission, scope: next });
    }
  }
  return out;
}

export function RbacPermissionMatrix() {
  const { t } = useLanguage();
  const matrixQuery = useRbacMatrix();
  const overridesQuery = useRbacOverrides();
  const saveMutation = usePutRbacOverrides();
  const resetMutation = useResetRbacMatrix();

  const [draft, setDraft] = useState<Record<string, PermissionScope>>({});
  const [onlyOverrides, setOnlyOverrides] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RbacRole | "">("");
  /** Default: business ops only — hide system group (CONFIG_SYS / BACKUP). */
  const [groupFilter, setGroupFilter] = useState<RbacGroupFilter>("business");
  const [search, setSearch] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  const matrix = matrixQuery.data;
  const cells = matrix?.cells ?? [];

  useEffect(() => {
    if (!matrix?.cells) return;
    setDraft(buildDraftMap(matrix.cells));
  }, [matrix]);

  const cellByKey = useMemo(() => {
    const map = new Map<string, RbacMatrixCell>();
    for (const cell of cells) {
      map.set(rbacCellKey(cell.role, cell.permission), cell);
    }
    return map;
  }, [cells]);

  const roles = useMemo(() => {
    const fromApi = matrix?.roles ?? [];
    if (!roleFilter) return fromApi;
    return fromApi.filter((r) => r === roleFilter);
  }, [matrix?.roles, roleFilter]);

  const scopes = matrix?.scopes?.length ? matrix.scopes : FALLBACK_SCOPES;

  const permissionRows = useMemo(() => {
    const list = matrix?.permissions ?? [];
    const q = search.trim().toLowerCase();
    const filtered = list.filter((permission) => {
      if (!permissionMatchesGroupFilter(permission, groupFilter)) return false;
      if (onlyOverrides) {
        const hasOverride = roles.some((role) => {
          const cell = cellByKey.get(rbacCellKey(role, permission));
          if (!cell) return false;
          const key = rbacCellKey(role, permission);
          const current = draft[key] ?? cell.scope;
          return cell.overridden || current !== cell.defaultScope;
        });
        if (!hasOverride) return false;
      }
      if (!q) return true;
      const desc = permissionDescription(t, permission, cellByKey);
      return (
        permission.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q)
      );
    });

    const showHeaders = groupFilter === "business" || groupFilter === "all";
    if (!showHeaders) {
      return filtered.map((permission) => ({ type: "perm" as const, permission }));
    }

    const remaining = new Set(filtered);
    const rows: Array<
      | { type: "header"; groupId: RbacPermissionGroupId }
      | { type: "perm"; permission: RbacPermission }
    > = [];

    for (const group of RBAC_PERMISSION_GROUPS) {
      if (groupFilter === "business" && group.id === "system") continue;
      const inGroup = group.permissions.filter((p) => remaining.has(p));
      if (!inGroup.length) continue;
      rows.push({ type: "header", groupId: group.id });
      for (const permission of inGroup) {
        rows.push({ type: "perm", permission });
        remaining.delete(permission);
      }
    }
    // Any API permission not listed in groups (future codes)
    if (remaining.size) {
      for (const permission of filtered) {
        if (remaining.has(permission)) {
          rows.push({ type: "perm", permission });
        }
      }
    }
    return rows;
  }, [
    matrix?.permissions,
    groupFilter,
    onlyOverrides,
    roles,
    cellByKey,
    draft,
    search,
    t,
  ]);

  const dirtyCells = useMemo(() => {
    if (!matrix?.cells) return [];
    return buildDiff(matrix.cells, draft).filter((cell) =>
      isMatrixUiPermission(cell.permission),
    );
  }, [matrix?.cells, draft]);
  const isDirty = dirtyCells.length > 0;
  const busy = saveMutation.isPending || resetMutation.isPending;

  const onScopeChange = (role: RbacRole, permission: RbacPermission, scope: PermissionScope) => {
    if (scope === "NONE" && isRbacLockoutCell(role, permission)) return;
    setDraft((prev) => ({
      ...prev,
      [rbacCellKey(role, permission)]: scope,
    }));
  };

  const onSave = async () => {
    if (!dirtyCells.length) return;
    await saveMutation.mutateAsync({ cells: dirtyCells });
  };

  const onResetAll = async () => {
    await resetMutation.mutateAsync();
    setResetOpen(false);
  };

  const roleLabel = (role: RbacRole) => {
    const key = `admin.rbac.roles.${role}`;
    const label = t(key);
    return label === key ? role : label;
  };

  const scopeLabel = (scope: PermissionScope) => {
    const key = `admin.rbac.scopes.${scope}`;
    const label = t(key);
    return label === key ? scope : label;
  };

  return (
    <>
      <AdminPageHeader
        title={t("admin.rbac.title")}
        description={t("admin.rbac.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="mq-admin-btn mq-admin-btn-secondary"
              disabled={matrixQuery.isFetching || busy}
              onClick={() => {
                void matrixQuery.refetch();
                void overridesQuery.refetch();
              }}
            >
              <RefreshCw size={16} strokeWidth={2.25} />
              {t("admin.rbac.refresh")}
            </button>
            <button
              type="button"
              className="mq-admin-btn mq-admin-btn-danger"
              disabled={busy || (matrix?.overrideCount ?? 0) === 0}
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw size={16} strokeWidth={2.25} />
              {t("admin.rbac.resetAll")}
            </button>
            <button
              type="button"
              className="mq-admin-btn mq-admin-btn-approve"
              disabled={!isDirty || busy}
              onClick={() => void onSave()}
            >
              <Save size={16} strokeWidth={2.25} />
              {saveMutation.isPending
                ? t("admin.common.saving")
                : t("admin.common.save")}
            </button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-mq-text-muted min-w-[12rem] flex-1">
            {t("admin.rbac.search")}
            <input
              type="search"
              className="mq-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.rbac.searchPlaceholder")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-mq-text-muted min-w-[10rem]">
            {t("admin.rbac.filterRole")}
            <select
              className="mq-input mq-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter((e.target.value || "") as RbacRole | "")}
            >
              <option value="">{t("admin.rbac.allRoles")}</option>
              {(matrix?.roles ?? []).map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-mq-text-muted min-w-[12rem]">
            {t("admin.rbac.filterGroup")}
            <select
              className="mq-input mq-select"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as RbacGroupFilter)}
            >
              <option value="business">{t("admin.rbac.groups.business")}</option>
              {businessGroupOptions().map((id) => (
                <option key={id} value={id}>
                  {t(`admin.rbac.groups.${id}`)}
                </option>
              ))}
              <option value="system">{t("admin.rbac.groups.system")}</option>
              <option value="all">{t("admin.rbac.groups.all")}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-mq-text pb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyOverrides}
              onChange={(e) => setOnlyOverrides(e.target.checked)}
            />
            {t("admin.rbac.onlyOverrides")}
          </label>
          <p className="text-xs text-mq-text-muted pb-2 ml-auto">
            {t("admin.rbac.overrideCount", {
              count: String(matrix?.overrideCount ?? 0),
            })}
            {isDirty
              ? ` · ${t("admin.rbac.dirtyCount", { count: String(dirtyCells.length) })}`
              : ""}
          </p>
        </div>

        {matrixQuery.isError && (
          <div className="mq-alert mq-alert-error">
            {getErrorMessage(matrixQuery.error, t("admin.common.failed"))}
          </div>
        )}

        {matrixQuery.isLoading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="mq-table-wrap mq-rbac-matrix-wrap">
            <table className="mq-rbac-matrix-table">
              <thead>
                <tr>
                  <th className="mq-rbac-sticky-col">{t("admin.rbac.permission")}</th>
                  {roles.map((role) => (
                    <th key={role} title={role}>
                      {roleLabel(role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(1, roles.length) + 1}
                      className="p-4 text-center text-mq-text-muted text-sm"
                    >
                      {t("admin.rbac.emptyFilter")}
                    </td>
                  </tr>
                ) : (
                  permissionRows.map((row) => {
                    if (row.type === "header") {
                      return (
                        <tr key={`g-${row.groupId}`} className="mq-rbac-group-row">
                          <th
                            className="mq-rbac-sticky-col mq-rbac-group-head"
                            scope="colgroup"
                            colSpan={Math.max(1, roles.length) + 1}
                          >
                            {t(`admin.rbac.groups.${row.groupId}`)}
                          </th>
                        </tr>
                      );
                    }
                    const permission = row.permission;
                    const sample = roles
                      .map((role) => cellByKey.get(rbacCellKey(role, permission)))
                      .find(Boolean);
                    const desc = permissionDescription(t, permission, cellByKey);
                    return (
                      <tr key={permission}>
                        <th className="mq-rbac-sticky-col" scope="row" title={desc}>
                          <span className="mq-rbac-perm-code">{permission}</span>
                          <span className="mq-rbac-perm-desc">{desc}</span>
                        </th>
                        {roles.map((role) => {
                          const cell = cellByKey.get(rbacCellKey(role, permission));
                          if (!cell) {
                            return (
                              <td key={role} className="mq-rbac-cell">
                                —
                              </td>
                            );
                          }
                          const key = rbacCellKey(role, permission);
                          const value = draft[key] ?? cell.scope;
                          const dirty = value !== cell.scope;
                          const overriddenVisual =
                            cell.overridden || value !== cell.defaultScope;
                          const lockout = isRbacLockoutCell(role, permission);
                          return (
                            <td
                              key={role}
                              className={[
                                "mq-rbac-cell",
                                overriddenVisual ? "is-overridden" : "",
                                dirty ? "is-dirty" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <select
                                className="mq-input mq-select mq-rbac-scope-select"
                                value={value}
                                disabled={busy}
                                aria-label={`${permission} × ${role}`}
                                title={
                                  overriddenVisual
                                    ? t("admin.rbac.overriddenHint", {
                                        default: cell.defaultScope,
                                      })
                                    : desc || sample?.description || permission
                                }
                                onChange={(e) =>
                                  onScopeChange(
                                    role,
                                    permission,
                                    e.target.value as PermissionScope,
                                  )
                                }
                              >
                                {scopes.map((scope) => (
                                  <option
                                    key={scope}
                                    value={scope}
                                    disabled={lockout && scope === "NONE"}
                                  >
                                    {scopeLabel(scope)}
                                  </option>
                                ))}
                              </select>
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
        )}

        <OverridesPanel
          loading={overridesQuery.isLoading}
          error={overridesQuery.isError ? overridesQuery.error : null}
          rows={overridesQuery.data ?? []}
          roleLabel={roleLabel}
          scopeLabel={scopeLabel}
        />
      </div>

      <AdminConfirmModal
        open={resetOpen}
        title={t("admin.rbac.resetConfirmTitle")}
        description={t("admin.rbac.resetConfirmDesc")}
        confirmLabel={t("admin.rbac.resetConfirmAction")}
        tone="danger"
        busy={resetMutation.isPending}
        onClose={() => setResetOpen(false)}
        onConfirm={onResetAll}
      />
    </>
  );
}

function permissionDescription(
  t: (key: string, vars?: Record<string, string>) => string,
  permission: RbacPermission,
  cellByKey: Map<string, RbacMatrixCell>,
): string {
  const key = `admin.rbac.permissions.${permission}`;
  const translated = t(key);
  if (translated !== key) return translated;
  for (const cell of cellByKey.values()) {
    if (cell.permission === permission && cell.description) return cell.description;
  }
  return permission;
}

function OverridesPanel({
  loading,
  error,
  rows,
  roleLabel,
  scopeLabel,
}: {
  loading: boolean;
  error: unknown;
  rows: Array<{
    id: string;
    role: RbacRole;
    permission: RbacPermission;
    scope: PermissionScope;
    defaultScope: PermissionScope;
    updatedByUserId: string;
    updatedAt: string;
  }>;
  roleLabel: (role: RbacRole) => string;
  scopeLabel: (scope: PermissionScope) => string;
}) {
  const { t } = useLanguage();

  return (
    <section className="mq-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-mq-text">{t("admin.rbac.overridesTitle")}</h2>
        <p className="text-xs text-mq-text-muted mt-0.5">{t("admin.rbac.overridesDesc")}</p>
      </div>
      {error ? (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      ) : null}
      {loading ? (
        <TableSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-mq-text-muted">{t("admin.rbac.overridesEmpty")}</p>
      ) : (
        <div className="mq-table-wrap">
          <table>
            <thead>
              <tr>
                <th className="p-2 text-left">{t("admin.rbac.permission")}</th>
                <th className="p-2 text-left">{t("admin.rbac.role")}</th>
                <th className="p-2 text-left">{t("admin.rbac.scope")}</th>
                <th className="p-2 text-left">{t("admin.rbac.defaultScope")}</th>
                <th className="p-2 text-left">{t("admin.rbac.updatedBy")}</th>
                <th className="p-2 text-left">{t("admin.rbac.updatedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-mq-border">
                  <td className="p-2 font-mono text-xs">{row.permission}</td>
                  <td className="p-2 text-xs">{roleLabel(row.role)}</td>
                  <td className="p-2">
                    <span className="mq-badge mq-badge-cyan">{scopeLabel(row.scope)}</span>
                  </td>
                  <td className="p-2 text-xs text-mq-text-muted">
                    {scopeLabel(row.defaultScope)}
                  </td>
                  <td className="p-2 text-xs text-mq-text-muted">—</td>
                  <td className="p-2 text-xs text-mq-text-muted whitespace-nowrap">
                    {formatWhen(row.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
