import type { Warehouse } from "@/lib/api/inventory";

/**
 * Display label for a warehouse, e.g. `[VN] KHO-HCM`.
 *
 * Transfer responses only carry `fromWarehouseId` / `toWarehouseId` (no nested
 * warehouse object), so callers resolve the id against the shop's warehouse
 * list and pass the id as a fallback for warehouses they cannot see.
 */
export function formatWarehouseLabel(
  warehouse: Warehouse | undefined | null,
  fallbackId?: string | null,
): string {
  if (warehouse) {
    const country = warehouse.countryCode ? `[${warehouse.countryCode}] ` : "";
    return `${country}${warehouse.code}`;
  }
  if (fallbackId) return "—";
  return "—";
}
