"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { OtpCountdown } from "@/components/auth/OtpCountdown";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useLanguage } from "@/components/providers/LanguageProvider";

type MsgKey =
  | "account.forgot.otpSent"
  | "account.forgot.passwordUpdated"
  | "account.forgot.invalidOtp"
  | "account.forgot.otpExpired"
  | "account.forgot.tooManyRequests"
  | "account.forgot.requestFailed"
  | "account.forgot.resetFailed"
  | "account.messages.passwordTooShort";

/**
 * Forgot-password UI — anti-enumeration:
 * BE always returns success for request-otp (even if email missing / not ACTIVE).
 * Always show the same “if email exists…” message; never branch on user existence.
 * Reset maps missing user → INVALID_OTP (same as wrong OTP).
 */
export function LostPasswordContent() {
  const { t } = useLanguage();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errorKey, setErrorKey] = useState<MsgKey | "">("");
  const [errorRaw, setErrorRaw] = useState("");
  const [okKey, setOkKey] = useState<MsgKey | "">("");
  const [busy, setBusy] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [expired, setExpired] = useState(false);

  const clearAlerts = () => {
    setErrorKey("");
    setErrorRaw("");
    setOkKey("");
  };

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    setBusy(true);
    try {
      // Success for every email (exists or not) — never inspect response for “user found”.
      await authApi.forgotPassword({ email: email.trim() });
      setOkKey("account.forgot.otpSent");
      setStep("reset");
      setCode("");
      setNewPassword("");
      setExpired(false);
      setTimerKey((key) => key + 1);
    } catch (err) {
      // Only real failures (e.g. rate limit / validation) — not “user not found”.
      if (err instanceof ApiError && err.code === "TOO_MANY_REQUESTS") {
        setErrorKey("account.forgot.tooManyRequests");
      } else if (err instanceof ApiError) {
        setErrorRaw(err.message);
      } else {
        setErrorKey("account.forgot.requestFailed");
      }
    } finally {
      setBusy(false);
    }
  };

  const onReset = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (expired) {
      setErrorKey("account.forgot.otpExpired");
      return;
    }
    if (newPassword.length < 8) {
      setErrorKey("account.messages.passwordTooShort");
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword({
        email: email.trim(),
        code,
        newPassword,
      });
      setOkKey("account.forgot.passwordUpdated");
      setCode("");
      setNewPassword("");
    } catch (err) {
      const codeName = err instanceof ApiError ? err.code : null;
      // Missing / inactive user and wrong OTP share INVALID_OTP — same copy.
      if (codeName === "INVALID_OTP") {
        setErrorKey("account.forgot.invalidOtp");
      } else if (codeName === "TOO_MANY_REQUESTS") {
        setErrorKey("account.forgot.tooManyRequests");
      } else if (err instanceof ApiError) {
        setErrorRaw(err.message);
      } else {
        setErrorKey("account.forgot.resetFailed");
      }
    } finally {
      setBusy(false);
    }
  };

  const errorText = errorKey ? t(errorKey) : errorRaw;
  const okText = okKey ? t(okKey) : "";

  return (
    <AuthPanel
      title={t("account.lostPasswordTitle")}
      description={t("account.lostPasswordDesc")}
      asideTitle={t("account.forgot.asideTitle")}
      asideText={t("account.forgot.asideText")}
      footer={<Link href="/my-account">{t("account.backToLogin")}</Link>}
    >
      {errorText ? <div className="mq-alert mq-alert-error">{errorText}</div> : null}
      {okText ? <div className="mq-alert mq-alert-success">{okText}</div> : null}
      {step === "request" ? (
        <form className="mq-auth-actions flex w-full flex-col gap-2.5" onSubmit={onRequest}>
          <div className="mq-auth-field">
            <label htmlFor="lost-email">{t("account.emailAddress")}</label>
            <input
              id="lost-email"
              type="email"
              className="mq-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <button type="submit" className="mq-btn mq-btn-primary w-full" disabled={busy}>
            {busy ? t("account.forgot.sending") : t("account.forgot.sendOtp")}
          </button>
        </form>
      ) : (
        <>
          <OtpCountdown resetKey={timerKey} onExpireChange={setExpired} />
          <form className="mq-auth-actions flex w-full flex-col gap-2.5" onSubmit={onReset}>
            <div className="mq-auth-field">
              <label htmlFor="reset-email">{t("account.emailAddress")}</label>
              <input
                id="reset-email"
                type="email"
                className="mq-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="mq-auth-field">
              <label htmlFor="reset-otp">{t("account.fields.otp")}</label>
              <input
                id="reset-otp"
                className="mq-input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={expired}
              />
            </div>
            <div className="mq-auth-field">
              <label htmlFor="reset-password">{t("account.forgot.newPassword")}</label>
              <input
                id="reset-password"
                type="password"
                className="mq-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="mq-btn mq-btn-primary w-full"
              disabled={busy || expired}
            >
              {busy ? t("account.forgot.saving") : t("account.forgot.setPassword")}
            </button>
            <button
              type="button"
              className="mq-btn mq-btn-outline w-full"
              onClick={() => {
                setStep("request");
                clearAlerts();
                setCode("");
                setNewPassword("");
              }}
            >
              {t("account.forgot.back")}
            </button>
          </form>
        </>
      )}
    </AuthPanel>
  );
}
