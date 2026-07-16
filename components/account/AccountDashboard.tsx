"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { isStrongPassword } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useAuth } from "@/components/providers/AuthProvider";
import { Container, PageHero } from "@/components/ui/shared";

function AccountInner() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [dateOfBirth, setDob] = useState(user?.dateOfBirth || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero title="My profile" breadcrumb={[{ label: "Account" }]} />
      <Container className="py-10 md:py-14 max-w-3xl mx-auto space-y-8">
        {err && <div className="mq-alert mq-alert-error">{err}</div>}
        {msg && <div className="mq-alert mq-alert-success">{msg}</div>}

        <div className="flex flex-wrap gap-3">
          <Link href="/orders" className="mq-btn mq-btn-outline text-xs">Orders</Link>
          <Link href="/rma" className="mq-btn mq-btn-outline text-xs">RMA</Link>
          <Link href="/wallet" className="mq-btn mq-btn-outline text-xs">Wallet</Link>
          <Link href="/seller" className="mq-btn mq-btn-outline text-xs">Seller</Link>
        </div>

        <section className="mq-card p-6 space-y-4">
          <h2 className="text-lg">Profile</h2>
          <p className="text-sm text-mq-text-muted">{user?.email}</p>
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void run(async () => {
                await authApi.updateProfile({
                  fullName: fullName || undefined,
                  avatarUrl: avatarUrl || undefined,
                  dateOfBirth: dateOfBirth || undefined,
                });
                await refreshUser();
                setMsg("Profile updated.");
              });
            }}
          >
            <input className="mq-input" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <input className="mq-input" placeholder="Avatar URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
            <input className="mq-input" type="date" value={dateOfBirth || ""} onChange={(e) => setDob(e.target.value)} />
            <button className="mq-btn mq-btn-primary" disabled={busy}>Save profile</button>
          </form>
        </section>

        <section className="mq-card p-6 space-y-4">
          <h2 className="text-lg">Change password</h2>
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!isStrongPassword(newPassword)) {
                setErr("Password must be ≥8 with uppercase + digit.");
                return;
              }
              void run(async () => {
                await authApi.changePassword({ currentPassword, newPassword });
                await logout();
                router.push("/my-account");
              });
            }}
          >
            <input type="password" className="mq-input" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            <input type="password" className="mq-input" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <button className="mq-btn mq-btn-primary" disabled={busy}>Update password</button>
          </form>
        </section>

        <section className="mq-card p-6 space-y-4">
          <h2 className="text-lg">Change email</h2>
          <div className="space-y-3">
            <input type="email" className="mq-input" placeholder="New email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <button
              type="button"
              className="mq-btn mq-btn-outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await authApi.requestEmailOtp({ newEmail });
                  setMsg("OTP sent to the new email.");
                })
              }
            >
              Request OTP
            </button>
            <input className="mq-input" placeholder="OTP code" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} />
            <button
              type="button"
              className="mq-btn mq-btn-primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await authApi.confirmEmailChange({ code: emailCode });
                  await refreshUser();
                  setMsg("Email updated.");
                })
              }
            >
              Confirm email
            </button>
          </div>
        </section>
      </Container>
    </>
  );
}

export function AccountDashboard() {
  return (
    <AuthGuard>
      <AccountInner />
    </AuthGuard>
  );
}
