import { ApiError } from "@/lib/api/client";
import { tt } from "@/lib/i18n/tt";

export function getErrorMessage(
  e: unknown,
  fallback = tt("toast.somethingWentWrong"),
): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}
