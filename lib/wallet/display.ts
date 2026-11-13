import { formatMoney, formatPoints } from "@/lib/api/utils";
import type { TransferPreviewResult } from "@/lib/api/wallet";

/**
 * Commission row amounts (M2): credited POINTS are the main figure, the TWD
 * ledger `payoutAmount` is secondary. `points == null` (legacy rows) -> "—".
 */
export function commissionAmounts(
  row: { points?: number | null; payoutAmount: string },
  pointUnit: string,
): { main: string; twd: string } {
  return {
    main: row.points == null ? "—" : formatPoints(row.points, pointUnit),
    twd: formatMoney(row.payoutAmount),
  };
}

/** P2P preview recipient (N9): API only returns masked values. */
export function transferPreviewLabel(preview: TransferPreviewResult): {
  primary: string;
  secondary: string | null;
} {
  return preview.maskedName
    ? { primary: preview.maskedName, secondary: preview.maskedEmail }
    : { primary: preview.maskedEmail, secondary: null };
}
