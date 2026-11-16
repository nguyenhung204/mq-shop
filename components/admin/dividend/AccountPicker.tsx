"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { adminApi } from "@/lib/api";
import type { AuthUser } from "@/lib/api/types";
import { parsePage } from "@/lib/api/utils";
import { useDebounce } from "@/lib/hooks/useDebounce";

function label(u: Pick<AuthUser, "email" | "fullName">): string {
  const name = u.fullName?.trim();
  return name ? `${name} · ${u.email}` : u.email;
}

/** Query options of the user search: a picker without search permission must never call /admin/users. */
export function pickerQueryOptions(search: boolean, q: string) {
  return { enabled: search, queryKey: ["admin", "users", "dividend-picker", q] as const };
}

/** Root-account picker backed by the admin user search (server-side filter by email / name). */
export function AccountPicker({
  value,
  onChange,
  ariaLabel,
  placeholder,
  disabled,
  known = [],
  search = true,
}: {
  value: string;
  onChange: (userId: string) => void;
  ariaLabel: string;
  placeholder: string;
  disabled?: boolean;
  /** Accounts already known to the page (holders) so the selected one always has a label. */
  known?: Array<{ userId: string; email: string | null; fullName: string | null }>;
  /** Query /admin/users (needs VIEW_USERS: ADMIN / SUPER_ADMIN). Otherwise only `known` accounts are offered. */
  search?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = useDebounce(query.trim(), 300);
  const { data } = useQuery({
    ...pickerQueryOptions(search, q),
    queryFn: async () => parsePage<AuthUser>(await adminApi.users({ page: 1, pageSize: 20, q: q || undefined })),
  });

  const options = useMemo<SearchableSelectOption[]>(() => {
    const map = new Map<string, SearchableSelectOption>();
    for (const k of known) {
      if (k.email) {
        map.set(k.userId, { value: k.userId, label: label({ email: k.email, fullName: k.fullName }), keywords: `${k.fullName ?? ""} ${k.email}` });
      }
    }
    for (const u of data?.items ?? []) {
      map.set(u.id, { value: u.id, label: label(u), keywords: `${u.fullName ?? ""} ${u.email}` });
    }
    return [...map.values()];
  }, [data?.items, known]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      placeholder={placeholder}
      searchPlaceholder={placeholder}
      onQueryChange={setQuery}
      filterLocally={false}
      disabled={disabled}
    />
  );
}
