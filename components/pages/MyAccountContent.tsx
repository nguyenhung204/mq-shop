"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { isStrongPassword, statusMessage } from "@/lib/api/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function MyAccountContent() {
  const { t } = useLanguage();
  const { user, login, logout, isAuthenticated, hasRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";

  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regName, setRegName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(loginId, loginPw);
      router.push("/account");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message || statusMessage(String(err.body?.message ?? ""))
          : "Login failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!isStrongPassword(regPw)) {
      setError("Password must be at least 8 characters with an uppercase letter and a digit.");
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
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  if (isAuthenticated && user) {
    return (
      <>
        <PageHero title={t("nav.account")} breadcrumb={[{ label: t("nav.account") }]} />
        <Container className="py-12 md:py-16 max-w-2xl mx-auto">
          <div className="mq-card p-6 md:p-8 space-y-4">
            <h2 className="text-xl text-mq-text">Welcome, {user.fullName || user.email}</h2>
            <p className="text-sm text-mq-text-secondary">
              Roles: {user.roles?.join(", ") || "BUYER"}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/account" className="mq-btn mq-btn-primary">Profile</Link>
              <Link href="/orders" className="mq-btn mq-btn-outline">Orders</Link>
              <Link href="/wallet" className="mq-btn mq-btn-outline">Wallet</Link>
              <Link href="/rma" className="mq-btn mq-btn-outline">RMA</Link>
              {hasRole("SELLER") && (
                <Link href="/seller" className="mq-btn mq-btn-outline">Seller Center</Link>
              )}
              {!hasRole("SELLER") && (
                <Link href="/seller/shop" className="mq-btn mq-btn-outline">Open a shop</Link>
              )}
              {(hasRole("ADMIN") || hasRole("SUPER_ADMIN")) && (
                <Link href="/admin" className="mq-btn mq-btn-outline">Admin</Link>
              )}
            </div>
            <button
              type="button"
              className="mq-btn mq-btn-outline mt-4"
              onClick={async () => {
                await logout();
                setInfo("Signed out.");
              }}
            >
              Sign out
            </button>
          </div>
        </Container>
      </>
    );
  }

  return (
    <>
      <PageHero title={t("nav.account")} breadcrumb={[{ label: t("nav.account") }]} />
      <Container className="py-12 md:py-16">
        {error && <div className="mq-alert mq-alert-error mb-6 max-w-4xl mx-auto">{error}</div>}
        {info && <div className="mq-alert mq-alert-success mb-6 max-w-4xl mx-auto">{info}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="mq-card p-6">
            <h2 className="text-xl text-mq-text mb-6">{t("account.login")}</h2>
            <form className="space-y-4" onSubmit={onLogin}>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t("account.username")}</label>
                <input
                  type="text"
                  className="mq-input"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t("account.password")}</label>
                <input
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
                className="block text-sm text-mq-text-muted hover:text-mq-text text-center transition-colors"
              >
                {t("account.lostPassword")}
              </Link>
            </form>
          </div>
          <div className="mq-card p-6">
            <h2 className="text-xl text-mq-text mb-6">{t("account.register")}</h2>
            <form className="space-y-4" onSubmit={onRegister}>
              <div>
                <label className="block text-sm font-medium mb-1.5">Full name</label>
                <input className="mq-input" value={regName} onChange={(e) => setRegName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t("account.emailAddress")}</label>
                <input
                  type="email"
                  className="mq-input"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t("account.password")}</label>
                <input
                  type="password"
                  className="mq-input"
                  value={regPw}
                  onChange={(e) => setRegPw(e.target.value)}
                  required
                />
              </div>
              {refCode && (
                <p className="text-xs text-mq-text-muted">Referral code: {refCode}</p>
              )}
              <p className="text-xs text-mq-text-muted">{t("account.registerNote")}</p>
              <button type="submit" className="mq-btn mq-btn-outline w-full" disabled={busy}>
                {t("account.register")}
              </button>
            </form>
          </div>
        </div>
      </Container>
    </>
  );
}
