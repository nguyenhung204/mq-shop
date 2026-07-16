"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { isStrongPassword } from "@/lib/api/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

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
    if (!isStrongPassword(newPassword)) {
      setError("Password must be at least 8 characters with an uppercase letter and a digit.");
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword({ email, code, newPassword });
      setOk("Password updated. You can sign in.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        title={t("account.lostPasswordTitle")}
        breadcrumb={[
          { label: t("nav.account"), href: "/my-account" },
          { label: t("account.lostPasswordTitle") },
        ]}
      />
      <Container className="py-12 md:py-16 max-w-md mx-auto">
        <div className="mq-card p-6">
          <p className="text-mq-text-secondary mb-6">{t("account.lostPasswordDesc")}</p>
          {error && <div className="mq-alert mq-alert-error mb-4">{error}</div>}
          {ok && <div className="mq-alert mq-alert-success mb-4">{ok}</div>}
          {step === "request" ? (
            <form className="space-y-4" onSubmit={onRequest}>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input type="email" className="mq-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button type="submit" className="mq-btn mq-btn-primary w-full" disabled={busy}>
                {t("account.resetPassword")}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onReset}>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input type="email" className="mq-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">OTP code</label>
                <input className="mq-input" value={code} onChange={(e) => setCode(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">New password</label>
                <input type="password" className="mq-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <button type="submit" className="mq-btn mq-btn-primary w-full" disabled={busy}>
                Set new password
              </button>
              <button type="button" className="mq-btn mq-btn-outline w-full" onClick={() => setStep("request")}>
                Back
              </button>
            </form>
          )}
          <Link
            href="/my-account"
            className="block mt-4 text-sm text-center text-mq-text-muted hover:text-mq-text transition-colors"
          >
            {t("account.backToLogin")}
          </Link>
        </div>
      </Container>
    </>
  );
}
