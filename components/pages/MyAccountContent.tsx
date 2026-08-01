"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { postAuthPath } from "@/lib/auth/routes";
import { getErrorMessage } from "@/lib/queries/utils";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function MyAccountContent() {
  const { t, locale } = useLanguage();
  const { user, login, logout, isAuthenticated, hasRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";
  const passwordReset = searchParams.get("passwordReset") === "1";
  const registerHref = refCode
    ? `/my-account/register?ref=${encodeURIComponent(refCode)}`
    : "/my-account/register";

  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginError, setLoginError] = useState<unknown>(null);
  const [infoKey, setInfoKey] = useState<string | null>(
    passwordReset ? "account.forgot.passwordUpdated" : null,
  );
  const [busy, setBusy] = useState(false);
  /** Avoid flashing the My Account hub before post-login navigation. */
  const [redirecting, setRedirecting] = useState(false);

  const error = useMemo(
    () =>
      loginError ? getErrorMessage(loginError, t("toast.somethingWentWrong"), locale) : "",
    [loginError, locale, t],
  );

  const info = useMemo(() => (infoKey ? t(infoKey) : ""), [infoKey, t]);

  useEffect(() => {
    if (!passwordReset || isAuthenticated) return;
    setInfoKey("account.forgot.passwordUpdated");
  }, [passwordReset, isAuthenticated]);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    setRedirecting(true);
    try {
      const loggedIn = await login(loginId, loginPw);
      router.replace(postAuthPath(loggedIn));
    } catch (err) {
      setRedirecting(false);
      setLoginError(err);
    } finally {
      setBusy(false);
    }
  };

  if (redirecting) {
    return (
      <AuthPanel
        title={t("account.login")}
        description={t("account.loginPage.description")}
        asideTitle={t("account.loginPage.asideTitle")}
        asideText={t("account.loginPage.asideText")}
      >
        <p className="py-8 text-center text-sm text-mq-text-muted">{t("account.loginPage.signingIn")}</p>
      </AuthPanel>
    );
  }

  if (isAuthenticated && user) {
    return (
      <>
        <PageHero title={t("nav.account")} breadcrumb={[{ label: t("nav.account") }]} />
        <Container className="py-12 md:py-16 max-w-2xl mx-auto">
          <div className="mq-card p-6 md:p-8 space-y-4">
            <h2 className="text-xl text-mq-text break-words">Welcome, {user.fullName || user.email}</h2>
            <p className="text-sm text-mq-text-secondary">
              Roles: {user.roles?.join(", ") || "BUYER"}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/account" className="mq-btn mq-btn-primary">
                Profile
              </Link>
              <Link href="/orders" className="mq-btn mq-btn-outline">
                Orders
              </Link>
              <Link href="/wallet" className="mq-btn mq-btn-outline">
                Wallet
              </Link>
              <Link href="/rma" className="mq-btn mq-btn-outline">
                RMA
              </Link>
              {hasRole("SELLER") && (
                <Link href="/seller" className="mq-btn mq-btn-outline">
                  Seller Center
                </Link>
              )}
              {hasRole("WAREHOUSE") && !hasRole("SELLER") && (
                <Link href="/seller/inventory" className="mq-btn mq-btn-outline">
                  Inventory
                </Link>
              )}
              {!hasRole("SELLER") && !hasRole("WAREHOUSE") && (
                <Link href="/seller/shop" className="mq-btn mq-btn-outline">
                  Open a shop
                </Link>
              )}
              {(hasRole("ADMIN") || hasRole("SUPER_ADMIN")) && (
                <Link href="/admin" className="mq-btn mq-btn-outline">
                  Admin
                </Link>
              )}
            </div>
            <button
              type="button"
              className="mq-btn mq-btn-outline mt-4"
              onClick={async () => {
                await logout();
                setInfoKey("account.messages.signedOut");
              }}
            >
              Sign out
            </button>
            {info && <div className="mq-alert mq-alert-success">{info}</div>}
          </div>
        </Container>
      </>
    );
  }

  return (
    <AuthPanel
      title={t("account.login")}
      description={t("account.loginPage.description")}
      asideTitle={t("account.loginPage.asideTitle")}
      asideText={t("account.loginPage.asideText")}
      footer={
        <>
          {t("account.noAccount")} <Link href={registerHref}>{t("account.register")}</Link>
        </>
      }
    >
      {error && <div className="mq-alert mq-alert-error">{error}</div>}
      {info && <div className="mq-alert mq-alert-success">{info}</div>}
      <form className="mq-auth-actions flex w-full flex-col gap-2.5" onSubmit={onLogin}>
        <div className="mq-auth-field">
          <label htmlFor="login-email">{t("account.loginPage.emailLabel")}</label>
          <input
            id="login-email"
            type="email"
            className="mq-input"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="mq-auth-field">
          <label htmlFor="login-password">{t("account.password")}</label>
          <input
            id="login-password"
            type="password"
            className="mq-input"
            value={loginPw}
            onChange={(e) => setLoginPw(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="mq-btn mq-btn-primary w-full" disabled={busy}>
          {t("account.logIn")}
        </button>
        <Link
          href="/my-account/lost-password"
          className="mq-auth-link block w-full text-center text-[0.72rem] text-mq-text-muted hover:text-mq-text"
        >
          {t("account.lostPassword")}
        </Link>
      </form>
    </AuthPanel>
  );
}
