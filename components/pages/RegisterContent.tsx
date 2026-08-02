"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { authApi } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/queries/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function RegisterContent() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regPwConfirm, setRegPwConfirm] = useState("");
  const [regName, setRegName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [apiError, setApiError] = useState<unknown>(null);
  const [localErrorKey, setLocalErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const error = useMemo(() => {
    if (localErrorKey) return t(localErrorKey);
    if (apiError) return getErrorMessage(apiError, t("toast.registrationFailed"), locale);
    return "";
  }, [localErrorKey, apiError, locale, t]);

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setLocalErrorKey(null);
    if (regPw.length < 8) {
      setLocalErrorKey("account.messages.passwordTooShort");
      return;
    }
    if (regPw !== regPwConfirm) {
      setLocalErrorKey("account.messages.passwordMismatch");
      return;
    }
    setBusy(true);
    try {
      await authApi.register({
        email: regEmail,
        password: regPw,
        fullName: regName || undefined,
        referrerCode: refCode || undefined,
      });
      router.push(`/my-account/verify-otp?email=${encodeURIComponent(regEmail)}`);
    } catch (err) {
      setApiError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPanel
      title={t("account.register")}
      description={t("account.registerPage.description")}
      asideTitle={t("account.registerPage.asideTitle")}
      asideText={t("account.registerPage.asideText")}
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
          <label htmlFor="reg-name">{t("account.registerPage.fullName")}</label>
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
          <div className="relative">
            <input
              id="reg-password"
              type={showPw ? "text" : "password"}
              className="mq-input pr-10"
              value={regPw}
              onChange={(e) => setRegPw(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={showPw ? t("account.hidePassword") : t("account.showPassword")}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-mq-text-muted hover:text-mq-text"
              onClick={() => setShowPw((v) => !v)}
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
        <div className="mq-auth-field">
          <label htmlFor="reg-password-confirm">{t("account.confirmPassword")}</label>
          <div className="relative">
            <input
              id="reg-password-confirm"
              type={showPwConfirm ? "text" : "password"}
              className="mq-input pr-10"
              value={regPwConfirm}
              onChange={(e) => setRegPwConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={showPwConfirm ? t("account.hidePassword") : t("account.showPassword")}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-mq-text-muted hover:text-mq-text"
              onClick={() => setShowPwConfirm((v) => !v)}
              tabIndex={-1}
            >
              {showPwConfirm ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
        {refCode ? (
          <p className="mq-auth-hint">{t("account.registerPage.referralCode", { code: refCode })}</p>
        ) : null}
        <p className="mq-auth-hint">{t("account.registerNote")}</p>
        <button type="submit" className="mq-btn mq-btn-primary w-full" disabled={busy}>
          {t("account.register")}
        </button>
      </form>
    </AuthPanel>
  );
}
