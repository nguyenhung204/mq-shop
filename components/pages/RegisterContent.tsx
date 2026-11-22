"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { authApi } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/queries/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useRegion } from "@/components/providers/RegionProvider";
import { stripParamFromLocation } from "@/lib/url-params";
import { inviteTokenFromQuery, keepInviteToken, registerReferral } from "@/lib/sub-accounts/model";
import { checkoutRegionCode } from "@/lib/i18n/region-sync";

export function RegisterContent() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";
  // The invite token is read from the URL once, kept in memory for the submit, and removed from the address bar
  // (history, screenshots, a copied URL) right away. A re-render without it must not lose it.
  const tokenInUrl = inviteTokenFromQuery(searchParams.get("invite"));
  const [keptInvite, setKeptInvite] = useState<string | undefined>(tokenInUrl);
  const { kept, token: inviteToken } = keepInviteToken(keptInvite, tokenInUrl);
  if (kept !== keptInvite) setKeptInvite(kept);
  useEffect(() => {
    if (!inviteToken || typeof window === "undefined") return;
    stripParamFromLocation(window.location, window.history, "invite");
  }, [inviteToken]);
  const { region } = useRegion();

  const [regEmail, setRegEmail] = useState("");
  const [regName, setRegName] = useState("");
  const [apiError, setApiError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const error = useMemo(() => {
    if (apiError) return getErrorMessage(apiError, t("toast.registrationFailed"), locale);
    return "";
  }, [apiError, locale, t]);

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setBusy(true);
    try {
      await authApi.register({
        email: regEmail,
        fullName: regName || undefined,
        ...registerReferral(inviteToken, refCode || undefined),
        // the region chosen in the gate / switcher; omitted when none was chosen (the API default is TW)
        regionCode: checkoutRegionCode(region),
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
      {inviteToken ? <div className="mq-alert mq-alert-success">{t("subAccounts.register.inviteBanner")}</div> : null}
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
