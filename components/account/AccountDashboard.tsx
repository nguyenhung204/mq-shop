"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  LogOut,
  Mail,
  Network,
  Package,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useSellerShop } from "@/lib/queries/seller";
import { useCreateMyDsar, useMyDsarRequests } from "@/lib/queries/compliance";
import { Container } from "@/components/ui/shared";
import "./account.css";

type AccountSection = "profile" | "password" | "email" | "privacy" | "links";

function userInitials(user: AuthUser | null | undefined): string {
  const name = user?.fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return (user?.email?.[0] || "U").toUpperCase();
}

function AccountAvatar({ user, size = "lg" }: { user: AuthUser | null; size?: "sm" | "lg" }) {
  const className = size === "lg" ? "mq-account-avatar mq-account-avatar-lg" : "mq-account-avatar";
  if (user?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt="" className={className} width={72} height={72} />
    );
  }
  return (
    <span className={`${className} mq-account-avatar-fallback`} aria-hidden="true">
      {userInitials(user)}
    </span>
  );
}

function AccountInner() {
  const { t } = useLanguage();
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const { data: shop } = useSellerShop();
  const hasShop = Boolean(shop);
  const [section, setSection] = useState<AccountSection>("profile");
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dsarNote, setDsarNote] = useState("");
  const { data: dsarPage, isLoading: dsarLoading } = useMyDsarRequests();
  const createDsar = useCreateMyDsar();
  const dsarItems = dsarPage?.items ?? [];

  const navItems = useMemo(
    () =>
      [
        { id: "profile" as const, label: t("account.nav.profile"), icon: UserRound },
        { id: "password" as const, label: t("account.nav.password"), icon: KeyRound },
        { id: "email" as const, label: t("account.nav.email"), icon: Mail },
        { id: "privacy" as const, label: t("account.nav.privacy"), icon: ShieldAlert },
        { id: "links" as const, label: t("account.nav.activity"), icon: Package },
      ] as const,
    [t],
  );

  const run = async (fn: () => Promise<void>) => {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : null;
      setErr(
        code
          ? `${e instanceof ApiError ? e.message : "Request failed"} (${code})`
          : e instanceof ApiError
            ? e.message
            : "Request failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const selectSection = (next: AccountSection) => {
    setSection(next);
    setErr("");
    setMsg("");
  };

  return (
    <section className="mq-account-page bg-mq-surface-subtle py-7 md:py-10">
      <Container className="mq-account-shell grid grid-cols-1 gap-5 items-start lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
        <aside className="mq-account-sidebar lg:sticky lg:top-[calc(var(--mq-header-h)+1rem)]">
          <div className="mq-account-identity lg:flex-col lg:items-start">
            <AccountAvatar user={user} />
            <div className="mq-account-identity-text">
              <p className="mq-account-kicker">{t("account.myProfile")}</p>
              <h1 className="mq-account-name">{user?.fullName || user?.email || "—"}</h1>
              {user?.fullName ? <p className="mq-account-email">{user.email}</p> : null}
              {user?.roles?.length ? (
                <p className="mq-account-roles">{user.roles.join(" · ")}</p>
              ) : null}
            </div>
          </div>

          <nav
            className="mq-account-nav flex flex-row gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible"
            aria-label={t("account.myProfile")}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`mq-account-nav-item inline-flex shrink-0 items-center gap-2${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => selectSection(item.id)}
                >
                  <Icon size={17} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            className="mq-account-signout"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await logout();
                router.push("/my-account");
              })
            }
          >
            <LogOut size={16} strokeWidth={1.75} />
            {t("account.signOut")}
          </button>
        </aside>

        <div className="mq-account-main flex min-w-0 flex-col gap-3.5">
          {err ? <div className="mq-alert mq-alert-error">{err}</div> : null}
          {msg ? <div className="mq-alert mq-alert-success">{msg}</div> : null}

          {section === "profile" ? (
            <section className="mq-account-panel">
              <header className="mq-account-panel-head">
                <h2>{t("account.sections.profileTitle")}</h2>
                <p>{t("account.sections.profileDesc")}</p>
              </header>
              <form
                className="mq-account-form"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void run(async () => {
                    await authApi.updateProfile({ fullName: fullName || undefined });
                    if (avatarFile) await authApi.uploadAvatar(avatarFile);
                    await refreshUser();
                    setAvatarFile(null);
                    setMsg(t("account.messages.profileUpdated"));
                  });
                }}
              >
                <div className="mq-account-avatar-row">
                  <AccountAvatar user={user} size="sm" />
                  <div className="mq-account-field">
                    <label htmlFor="account-avatar">{t("account.fields.avatar")}</label>
                    <input
                      id="account-avatar"
                      className="mq-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    />
                    <p className="mq-account-hint">{t("account.fields.avatarHint")}</p>
                  </div>
                </div>
                <div className="mq-account-field">
                  <label htmlFor="account-fullname">{t("account.fields.fullName")}</label>
                  <input
                    id="account-fullname"
                    className="mq-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="mq-account-field">
                  <label htmlFor="account-email-readonly">{t("account.emailAddress")}</label>
                  <input
                    id="account-email-readonly"
                    className="mq-input"
                    value={user?.email || ""}
                    readOnly
                    disabled
                  />
                </div>
                <button type="submit" className="mq-btn mq-btn-primary" disabled={busy}>
                  {t("account.actions.saveProfile")}
                </button>
              </form>
            </section>
          ) : null}

          {section === "password" ? (
            <section className="mq-account-panel">
              <header className="mq-account-panel-head">
                <h2>{t("account.sections.passwordTitle")}</h2>
                <p>{t("account.sections.passwordDesc")}</p>
              </header>
              <form
                className="mq-account-form"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  if (newPassword.length < 8) {
                    setErr(t("account.messages.passwordTooShort"));
                    return;
                  }
                  void run(async () => {
                    await authApi.changePassword({ currentPassword, newPassword });
                    await logout();
                    router.push("/my-account");
                  });
                }}
              >
                <div className="mq-account-field">
                  <label htmlFor="account-current-pw">{t("account.fields.currentPassword")}</label>
                  <input
                    id="account-current-pw"
                    type="password"
                    className="mq-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="mq-account-field">
                  <label htmlFor="account-new-pw">{t("account.fields.newPassword")}</label>
                  <input
                    id="account-new-pw"
                    type="password"
                    className="mq-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="mq-btn mq-btn-primary" disabled={busy}>
                  {t("account.actions.updatePassword")}
                </button>
              </form>
            </section>
          ) : null}

          {section === "email" ? (
            <section className="mq-account-panel">
              <header className="mq-account-panel-head">
                <h2>{t("account.sections.emailTitle")}</h2>
                <p>{t("account.sections.emailDesc")}</p>
              </header>
              <div className="mq-account-form">
                <div className="mq-account-field">
                  <label htmlFor="account-new-email">{t("account.fields.newEmail")}</label>
                  <input
                    id="account-new-email"
                    type="email"
                    className="mq-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <button
                  type="button"
                  className="mq-btn mq-btn-outline"
                  disabled={busy || !newEmail}
                  onClick={() =>
                    void run(async () => {
                      await authApi.requestEmailOtp({ newEmail });
                      setMsg(t("account.messages.otpSent"));
                    })
                  }
                >
                  {t("account.actions.requestOtp")}
                </button>
                <div className="mq-account-field">
                  <label htmlFor="account-email-otp">{t("account.fields.otp")}</label>
                  <input
                    id="account-email-otp"
                    className="mq-input"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                  />
                </div>
                <button
                  type="button"
                  className="mq-btn mq-btn-primary"
                  disabled={busy || emailCode.length !== 6}
                  onClick={() =>
                    void run(async () => {
                      await authApi.confirmEmailChange({ email: newEmail, otp: emailCode });
                      await refreshUser();
                      setMsg(t("account.messages.emailUpdated"));
                    })
                  }
                >
                  {t("account.actions.confirmEmail")}
                </button>
              </div>
            </section>
          ) : null}

          {section === "privacy" ? (
            <section className="mq-account-panel">
              <header className="mq-account-panel-head">
                <h2>{t("account.sections.privacyTitle")}</h2>
                <p>{t("account.sections.privacyDesc")}</p>
              </header>
              <form
                className="mq-account-form"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void run(async () => {
                    await createDsar.mutateAsync(dsarNote || undefined);
                    setDsarNote("");
                    setMsg(t("account.messages.dsarSubmitted"));
                  });
                }}
              >
                <div className="mq-account-field">
                  <label htmlFor="account-dsar-note">{t("account.fields.dsarNote")}</label>
                  <textarea
                    id="account-dsar-note"
                    className="mq-input min-h-[5rem]"
                    value={dsarNote}
                    onChange={(e) => setDsarNote(e.target.value)}
                    maxLength={500}
                    placeholder={t("account.fields.dsarNotePh")}
                  />
                </div>
                <button
                  type="submit"
                  className="mq-btn mq-btn-primary"
                  disabled={busy || createDsar.isPending}
                >
                  {t("account.actions.submitDsar")}
                </button>
              </form>
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-medium text-mq-text">{t("account.dsar.history")}</h3>
                {dsarLoading ? (
                  <p className="text-sm text-mq-text-muted">{t("admin.common.loading")}</p>
                ) : dsarItems.length === 0 ? (
                  <p className="text-sm text-mq-text-muted">{t("account.dsar.empty")}</p>
                ) : (
                  <ul className="space-y-2">
                    {dsarItems.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-lg border border-mq-border bg-mq-surface-subtle px-3 py-2 text-sm flex flex-wrap gap-2 justify-between"
                      >
                        <span className="font-mono text-xs text-mq-text-muted">
                          {r.id.slice(0, 8)}…
                        </span>
                        <span className="mq-badge mq-badge-muted">{r.status}</span>
                        <span className="text-xs text-mq-text-muted w-full sm:w-auto">
                          {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ) : null}

          {section === "links" ? (
            <section className="mq-account-panel">
              <header className="mq-account-panel-head">
                <h2>{t("account.sections.activityTitle")}</h2>
                <p>{t("account.sections.activityDesc")}</p>
              </header>
              <div className="mq-account-link-grid">
                <Link href="/orders" className="mq-account-link-card">
                  <Package size={20} strokeWidth={1.75} />
                  <span>
                    <strong>{t("account.links.orders")}</strong>
                    <small>{t("account.links.ordersDesc")}</small>
                  </span>
                </Link>
                <Link href="/transactions" className="mq-account-link-card">
                  <Receipt size={20} strokeWidth={1.75} />
                  <span>
                    <strong>{t("account.links.transactions")}</strong>
                    <small>{t("account.links.transactionsDesc")}</small>
                  </span>
                </Link>
                <Link href="/wallet" className="mq-account-link-card">
                  <Wallet size={20} strokeWidth={1.75} />
                  <span>
                    <strong>{t("account.links.wallet")}</strong>
                    <small>{t("account.links.walletDesc")}</small>
                  </span>
                </Link>
                <Link href="/mlm/network" className="mq-account-link-card">
                  <Network size={20} strokeWidth={1.75} />
                  <span>
                    <strong>{t("account.links.network")}</strong>
                    <small>{t("account.links.networkDesc")}</small>
                  </span>
                </Link>
                <Link href="/rma" className="mq-account-link-card">
                  <RefreshCw size={20} strokeWidth={1.75} />
                  <span>
                    <strong>{t("account.links.rma")}</strong>
                    <small>{t("account.links.rmaDesc")}</small>
                  </span>
                </Link>
                <Link href="/seller/shop" className="mq-account-link-card">
                  <Store size={20} strokeWidth={1.75} />
                  <span>
                    <strong>
                      {hasShop ? t("account.links.myShop") : t("account.links.applyShop")}
                    </strong>
                    <small>
                      {hasShop
                        ? t("account.links.myShopDesc")
                        : t("account.links.applyShopDesc")}
                    </small>
                  </span>
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

export function AccountDashboard() {
  return (
    <AuthGuard>
      <AccountInner />
    </AuthGuard>
  );
}

export default AccountDashboard;
