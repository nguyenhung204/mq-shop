"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { authApi } from "@/lib/api/auth";
import { ApiError, setTokens } from "@/lib/api/client";
import { postAuthPath } from "@/lib/auth/routes";
import { useAuth } from "@/components/providers/AuthProvider";

export function VerifyOtpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await authApi.verifyOtp({ email, otp: code });
      if (data?.accessToken) setTokens(data.accessToken, data.refreshToken);
      if (data?.user) setUser(data.user);
      setOk("Email verified. You are signed in.");
      setTimeout(() => router.push(postAuthPath(data?.user)), 600);
    } catch (err) {
      const codeName = err instanceof ApiError ? err.code : null;
      if (codeName === "INVALID_OTP") setError("Invalid or expired OTP.");
      else if (codeName === "REGISTRATION_NOT_FOUND")
        setError("Registration session expired. Please register again.");
      else setError(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setError("");
    setBusy(true);
    try {
      await authApi.resendOtp({ email });
      setOk("OTP resent.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Resend failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPanel
      title="Verify email"
      description="Enter the 6-digit code we sent to your email."
      asideTitle="Almost there"
      asideText="One quick code to confirm your email and activate your MQ account."
      footer={
        <Link href="/my-account">Back to login</Link>
      }
    >
      {error && <div className="mq-alert mq-alert-error">{error}</div>}
      {ok && <div className="mq-alert mq-alert-success">{ok}</div>}
      <form className="mq-auth-actions flex w-full flex-col gap-2.5" onSubmit={onSubmit}>
        <div className="mq-auth-field">
          <label htmlFor="otp-email">Email</label>
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
          <label htmlFor="otp-code">OTP code</label>
          <input
            id="otp-code"
            className="mq-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>
        <button
          type="submit"
          className="mq-btn mq-btn-primary w-full"
          disabled={busy || code.length !== 6}
        >
          Verify
        </button>
        <button
          type="button"
          className="mq-btn mq-btn-outline w-full"
          disabled={busy || !email}
          onClick={() => void onResend()}
        >
          Resend OTP
        </button>
      </form>
    </AuthPanel>
  );
}
