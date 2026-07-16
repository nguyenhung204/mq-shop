"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Container, PageHero } from "@/components/ui/shared";

export function VerifyOtpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
      await authApi.verifyOtp({ email, code });
      setOk("Email verified. You can sign in now.");
      setTimeout(() => router.push("/my-account"), 800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero title="Verify email" breadcrumb={[{ label: "Account", href: "/my-account" }, { label: "Verify OTP" }]} />
      <Container className="py-12 md:py-16 max-w-md mx-auto">
        <div className="mq-card p-6 space-y-4">
          <p className="text-sm text-mq-text-secondary">
            Enter the OTP sent to your email to activate your account.
          </p>
          {error && <div className="mq-alert mq-alert-error">{error}</div>}
          {ok && <div className="mq-alert mq-alert-success">{ok}</div>}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input type="email" className="mq-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">OTP code</label>
              <input className="mq-input" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <button type="submit" className="mq-btn mq-btn-primary w-full" disabled={busy}>
              Verify
            </button>
          </form>
          <Link href="/my-account" className="block text-sm text-center text-mq-text-muted hover:text-mq-text">
            Back to login
          </Link>
        </div>
      </Container>
    </>
  );
}
