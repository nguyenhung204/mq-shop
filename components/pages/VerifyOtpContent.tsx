"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { OtpCountdown } from "@/components/auth/OtpCountdown";
import { authApi } from "@/lib/api/auth";
import { postAuthPath } from "@/lib/auth/routes";
import { getErrorMessage } from "@/lib/queries/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function VerifyOtpContent() {
  const { t, locale } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [apiError, setApiError] = useState<{ err: unknown; fallbackKey: string } | null>(null);
  const [localErrorKey, setLocalErrorKey] = useState<string | null>(null);
  const [okKey, setOkKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [expired, setExpired] = useState(false);

  const error = useMemo(() => {
    if (localErrorKey) return t(localErrorKey);
    if (apiError) return getErrorMessage(apiError.err, t(apiError.fallbackKey), locale);
    return "";
  }, [localErrorKey, apiError, locale, t]);

  const ok = useMemo(() => (okKey ? t(okKey) : ""), [okKey, t]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setLocalErrorKey(null);
    if (expired) {
      setLocalErrorKey("account.forgot.otpExpired");
      return;
    }
    setBusy(true);
    try {
      const data = await authApi.verifyOtp({ email, otp: code });
      setRedirecting(true);
      if (data?.user) setUser(data.user);
      router.replace(postAuthPath(data?.user));
    } catch (err) {
      setRedirecting(false);
      setApiError({ err, fallbackKey: "toast.verificationFailed" });
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setApiError(null);
    setLocalErrorKey(null);
    setOkKey(null);
    setBusy(true);
    try {
      await authApi.resendOtp({ email });
      setOkKey("account.verifyOtp.otpResent");
      setCode("");
      setExpired(false);
      setTimerKey((key) => key + 1);
    } catch (err) {
      setApiError({ err, fallbackKey: "toast.resendFailed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPanel
      title={t("account.verifyOtp.title")}
      description={t("account.verifyOtp.description")}
      asideTitle={t("account.verifyOtp.asideTitle")}
      asideText={t("account.verifyOtp.asideText")}
      footer={<Link href="/my-account">{t("account.backToLogin")}</Link>}
    >
      {redirecting ? (
        <p className="py-8 text-center text-sm text-mq-text-muted">
          {t("account.verifyOtp.signingIn")}
        </p>
      ) : (
        <>
          {error && <div className="mq-alert mq-alert-error">{error}</div>}
          {ok && <div className="mq-alert mq-alert-success">{ok}</div>}
          <OtpCountdown resetKey={timerKey} onExpireChange={setExpired} />
          <form className="mq-auth-actions flex w-full flex-col gap-2.5" onSubmit={onSubmit}>
            <div className="mq-auth-field">
              <label htmlFor="otp-email">{t("account.emailAddress")}</label>
              <input
                id="otp-email"
                type="email"
                className="mq-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mq-auth-field">
              <label htmlFor="otp-code">{t("account.verifyOtp.otpCode")}</label>
              <input
                id="otp-code"
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
            <button
              type="submit"
              className="mq-btn mq-btn-primary w-full"
              disabled={busy || expired || code.length !== 6}
            >
              {t("account.verifyOtp.verify")}
            </button>
            <button
              type="button"
              className="mq-btn mq-btn-outline w-full"
              disabled={busy || !email}
              onClick={() => void onResend()}
            >
              {t("account.verifyOtp.resendOtp")}
            </button>
          </form>
        </>
      )}
    </AuthPanel>
  );
}
