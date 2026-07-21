"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function LostPasswordContent() {
  const { t } = useLanguage();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authApi.forgotPassword({ email });
      setOk("If the email exists, an OTP was sent.");
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const onReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword({ email, code, newPassword });
      setOk("Password updated. You can sign in.");
    } catch (err) {
      const codeName = err instanceof ApiError ? err.code : null;
      if (codeName === "INVALID_OTP") setError("Invalid or expired OTP.");
      else setError(err instanceof ApiError ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPanel
      title={t("account.lostPasswordTitle")}
      description={t("account.lostPasswordDesc")}
      asideTitle="Reset access"
      asideText="We’ll email a code so you can set a new password securely."
      footer={
        <Link href="/my-account">{t("account.backToLogin")}</Link>
      }
    >
      {error && <div className="mq-alert mq-alert-error">{error}</div>}
      {ok && <div className="mq-alert mq-alert-success">{ok}</div>}
      {step === "request" ? (
        <form className="mq-auth-actions flex w-full flex-col gap-2.5" onSubmit={onRequest}>
          <div className="mq-auth-field">
            <label htmlFor="lost-email">Email</label>
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
            {t("account.resetPassword")}
          </button>
        </form>
      ) : (
        <form className="mq-auth-actions flex w-full flex-col gap-2.5" onSubmit={onReset}>
          <div className="mq-auth-field">
            <label htmlFor="reset-email">Email</label>
            <input
              id="reset-email"
              type="email"
              className="mq-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mq-auth-field">
            <label htmlFor="reset-otp">OTP code</label>
            <input
              id="reset-otp"
              className="mq-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              maxLength={6}
              inputMode="numeric"
            />
          </div>
          <div className="mq-auth-field">
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              type="password"
              className="mq-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="mq-btn mq-btn-primary w-full" disabled={busy}>
            Set new password
          </button>
          <button
            type="button"
            className="mq-btn mq-btn-outline w-full"
            onClick={() => setStep("request")}
          >
            Back
          </button>
        </form>
      )}
    </AuthPanel>
  );
}
