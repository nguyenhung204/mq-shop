import type { ConfirmDialogTone } from "@/components/ui/ConfirmDialog";

/** Transfer state changes that require an explicit confirmation. */
export type TransferAction = "approve" | "cancel" | "receive";

/**
 * Copy for the transfer confirmation modal, shared by the seller and admin
 * detail pages so both surfaces warn about the same stock side effects.
 */
export const TRANSFER_CONFIRM: Record<
  TransferAction,
  { titleKey: string; descKey: string; btnKey: string; tone: ConfirmDialogTone }
> = {
  approve: {
    titleKey: "confirm.transferApproveTitle",
    descKey: "confirm.transferApproveDesc",
    btnKey: "confirm.transferApproveBtn",
    tone: "warn",
  },
  receive: {
    titleKey: "confirm.transferReceiveTitle",
    descKey: "confirm.transferReceiveDesc",
    btnKey: "confirm.transferReceiveBtn",
    tone: "primary",
  },
  cancel: {
    titleKey: "confirm.transferCancelTitle",
    descKey: "confirm.transferCancelDesc",
    btnKey: "confirm.transferCancelBtn",
    tone: "danger",
  },
};
