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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
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

  return (
    <>
      <PageHero title="My profile" breadcrumb={[{ label: "Account" }]} />
      <Container className="py-10 md:py-14 max-w-3xl mx-auto space-y-8">
        {err && <div className="mq-alert mq-alert-error">{err}</div>}
        {msg && <div className="mq-alert mq-alert-success">{msg}</div>}

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/orders" className="mq-btn mq-btn-outline text-xs">
            Orders
          </Link>
          <Link href="/rma" className="mq-btn mq-btn-outline text-xs">
            RMA
          </Link>
          <Link href="/wallet" className="mq-btn mq-btn-outline text-xs">
            Wallet
          </Link>
          <Link href="/seller/shop" className="mq-btn mq-btn-outline text-xs">
            Apply shop
          </Link>
          <button
            type="button"
            className="mq-btn mq-btn-outline text-xs ml-auto"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await logout();
                router.push("/my-account");
              })
            }
          >
            Sign out
          </button>
        </div>

        <section className="mq-card p-6 space-y-4">
          <h2 className="text-lg">Profile</h2>
          <p className="text-sm text-mq-text-muted">{user?.email}</p>
          {user?.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover border border-mq-border"
            />
          )}
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void run(async () => {
                await authApi.updateProfile({ fullName: fullName || undefined });
                if (avatarFile) await authApi.uploadAvatar(avatarFile);
                await refreshUser();
                setAvatarFile(null);
                setMsg("Profile updated.");
              });
            }}
          >
            <input
              className="mq-input"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              className="mq-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-mq-text-muted">Avatar ≤5MB (JPEG/PNG/WebP/GIF)</p>
            <button className="mq-btn mq-btn-primary" disabled={busy}>
              Save profile
            </button>
          </form>
        </section>

        <section className="mq-card p-6 space-y-4">
          <h2 className="text-lg">Change password</h2>
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (newPassword.length < 8) {
                setErr("Password must be at least 8 characters.");
                return;
              }
              if (!isStrongPassword(newPassword) && newPassword.length < 8) {
                setErr("Password must be ≥8 characters.");
                return;
              }
              void run(async () => {
                await authApi.changePassword({ currentPassword, newPassword });
                await logout();
                router.push("/my-account");
              });
            }}
          >
            <input
              type="password"
              className="mq-input"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <input
              type="password"
              className="mq-input"
              placeholder="New password (min 8)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <button className="mq-btn mq-btn-primary" disabled={busy}>
              Update password
            </button>
          </form>
        </section>

        <section className="mq-card p-6 space-y-4">
          <h2 className="text-lg">Change email</h2>
          <div className="space-y-3">
            <input
              type="email"
              className="mq-input"
              placeholder="New email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
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
            <input
              className="mq-input"
              placeholder="OTP (6 digits)"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
            />
            <button
              type="button"
              className="mq-btn mq-btn-primary"
              disabled={busy || emailCode.length !== 6}
              onClick={() =>
                void run(async () => {
                  await authApi.confirmEmailChange({ email: newEmail, otp: emailCode });
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

export default AccountDashboard;
