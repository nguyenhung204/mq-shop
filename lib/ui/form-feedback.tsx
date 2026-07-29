"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/types";
import { getErrorMessage } from "@/lib/queries/utils";

/**
 * UI feedback conventions
 *
 * **Form (`mq-alert` in the form / modal):**
 * - Client-side validation (required, min length, file type/size)
 * - API errors from a form submit (`mutateAsync` in `onSubmit`)
 * - Optional inline success after save (profile updated, OTP sent)
 *
 * **Toast (Sonner):**
 * - One-click table/modal actions (approve, reject, lock, delete, toggle)
 * - Copy to clipboard, download started
 * - Background ops not tied to a visible form
 * - Global/session events (signed out elsewhere) — rare
 *
 * Form mutations must NOT call `toast.error` in hook `onError`; the page catches
 * and calls `setErrorFromApi`. Action mutations use `actionToastError` instead.
 */

type UseFormAlertsOptions = {
  locale: Locale | null;
  t: (key: string, vars?: Record<string, string>) => string;
  defaultErrorFallback?: string;
};

export function useFormAlerts({
  locale,
  t,
  defaultErrorFallback,
}: UseFormAlertsOptions) {
  const fallback = defaultErrorFallback ?? t("toast.somethingWentWrong");
  const [apiError, setApiError] = useState<unknown>(null);
  const [localErrorKey, setLocalErrorKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

  const error = useMemo(() => {
    if (localErrorKey) return t(localErrorKey);
    if (apiError) return getErrorMessage(apiError, fallback, locale);
    return "";
  }, [localErrorKey, apiError, fallback, locale, t]);

  const success = useMemo(() => (successKey ? t(successKey) : ""), [successKey, t]);

  const clearAlerts = useCallback(() => {
    setApiError(null);
    setLocalErrorKey(null);
    setSuccessKey(null);
  }, []);

  const setLocalError = useCallback((key: string) => {
    setApiError(null);
    setLocalErrorKey(key);
  }, []);

  const setErrorFromApi = useCallback((err: unknown) => {
    setLocalErrorKey(null);
    setApiError(err);
  }, []);

  const wrapSubmit = useCallback(
    async (fn: () => Promise<void>) => {
      clearAlerts();
      try {
        await fn();
      } catch (err) {
        setErrorFromApi(err);
      }
    },
    [clearAlerts, setErrorFromApi],
  );

  return {
    error,
    success,
    clearAlerts,
    setLocalError,
    setErrorFromApi,
    setSuccessKey,
    wrapSubmit,
    hasError: Boolean(error),
    hasSuccess: Boolean(success),
  };
}

export function FormAlerts({
  error,
  success,
}: {
  error?: string;
  success?: string;
}): ReactNode {
  if (!error && !success) return null;
  return (
    <>
      {error ? (
        <div className="mq-alert mq-alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mq-alert mq-alert-success" role="status">
          {success}
        </div>
      ) : null}
    </>
  );
}
