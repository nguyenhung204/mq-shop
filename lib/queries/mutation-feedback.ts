import { toast } from "sonner";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

/** Success toast for table actions, toggles, and other non-form operations. */
export function actionToastSuccess(message: string): void {
  toast.success(message);
}

/** Error toast for non-form operations (never use inside form submit handlers). */
export function actionToastError(
  e: unknown,
  fallback = tt("toast.somethingWentWrong"),
): void {
  toast.error(getErrorMessage(e, fallback));
}
