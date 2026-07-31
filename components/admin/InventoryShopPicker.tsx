"use client";

import { useMemo } from "react";
import { useAdminShops } from "@/lib/queries/admin";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

/**
 * Shop picker for WAREHOUSE staff with ALL-shop access.
 * Only renders for WAREHOUSE role (SELLER always uses own shop).
 */
export function InventoryShopPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (shopId: string) => void;
}) {
  const { t } = useLanguage();
  const { hasRole, user } = useAuth();
  const showPicker = hasRole("WAREHOUSE") || hasRole("ADMIN") || hasRole("SUPER_ADMIN");
  const { data: shopsPage } = useAdminShops("APPROVED", 1, 100);
  const shops = useMemo(() => shopsPage?.items ?? [], [shopsPage]);

  if (!showPicker) return null;

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-mq-text-muted whitespace-nowrap">
        {t("admin.inventory.shopPicker")}
      </label>
      <select
        className="mq-input max-w-[18rem]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {user?.shopId && (
          <option value={user.shopId}>
            {t("admin.inventory.myShop")}
          </option>
        )}
        {shops
          .filter((s) => s.id !== user?.shopId)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        {!user?.shopId && shops.length === 0 && (
          <option value="">{t("admin.inventory.noShops")}</option>
        )}
      </select>
    </div>
  );
}
