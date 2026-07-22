"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function RegisterContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regName, setRegName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (regPw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await authApi.register({
        email: regEmail,
        password: regPw,
        fullName: regName || undefined,
        referralCode: refCode || undefined,
      });
      router.push(`/my-account/verify-otp?email=${encodeURIComponent(regEmail)}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === "EMAIL_ALREADY_IN_USE") setError("Email already in use.");
      else if (code === "TOO_MANY_REQUESTS") setError("Too many requests. Try again later.");
      else setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPanel
      title={t("account.register")}
      description="Create an account to checkout faster and track orders."
      asideTitle="Join MQ"
      asideText="Create your account and unlock a calmer way to shop essentials."
      footer={
        <>
          {t("account.haveAccount")}{" "}
          <Link href="/my-account">{t("account.login")}</Link>
        </>
      }
    >
      {error && <div className="mq-alert mq-alert-error">{error}</div>}
      <form className="mq-auth-actions flex w-full flex-col gap-2.5" onSubmit={onRegister}>
        <div className="mq-auth-field">
          <label htmlFor="reg-name">Full name</label>
          <input
            id="reg-name"
            className="mq-input"
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="mq-auth-field">
          <label htmlFor="reg-email">{t("account.emailAddress")}</label>
          <input
            id="reg-email"
            type="email"
            className="mq-input"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="mq-auth-field">
          <label htmlFor="reg-password">{t("account.password")}</label>
          <input
            id="reg-password"
            type="password"
            className="mq-input"
            value={regPw}
            onChange={(e) => setRegPw(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        {refCode ? <p className="mq-auth-hint">Referral code: {refCode}</p> : null}
        <p className="mq-auth-hint">{t("account.registerNote")}</p>
        <button type="submit" className="mq-btn mq-btn-primary w-full" disabled={busy}>
          {t("account.register")}
        </button>
      </form>
    </AuthPanel>
  );
}
