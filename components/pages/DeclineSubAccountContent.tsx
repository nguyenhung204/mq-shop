"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useDeclineSubAccount } from "@/lib/queries/sub-accounts";
import { getErrorMessage } from "@/lib/queries/utils";
import { validateDecline, type DeclineErrors } from "@/lib/sub-accounts/model";

/**
 * Public page for the person at the e-mail of a reserved sub-account. To ACCEPT, they use the normal
 * forgot-password page (request a code, set a password). To REFUSE they enter the same code here.
 */
export function DeclineSubAccountContent() {
  const { t, locale } = useLanguage();
  const params = useSearchParams();
  const decline = useDeclineSubAccount();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<DeclineErrors[]>([]);
  const error = useMemo(() => {
    if (errors.length > 0) return errors.map((e) => t(`subAccounts.decline.errors.${e}`)).join(" ");
    if (decline.isError) return getErrorMessage(decline.error, t("subAccounts.decline.failed"), locale);
    return "";
  }, [errors, decline.isError, decline.error, t, locale]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = validateDecline({ email, code });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors([]);
    decline.mutate(res.body);
  };

  return (
    <AuthPanel
      title={t("subAccounts.decline.title")}
      description={t("subAccounts.decline.description")}
      footer={
        <>
          {t("subAccounts.decline.acceptHint")} <Link href="/my-account/lost-password">{t("subAccounts.decline.acceptLink")}</Link>
        </>
      }
    >
      {decline.isSuccess ? (
        <div className="mq-alert mq-alert-success">{t("subAccounts.decline.done")}</div>
      ) : (
        <form className="mq-auth-actions flex w-full flex-col gap-2.5" onSubmit={submit} noValidate>
          {error ? <div className="mq-alert mq-alert-error" role="alert">{error}</div> : null}
          <div className="mq-auth-field">
            <label htmlFor="decline-email">{t("account.emailAddress")}</label>
            <input id="decline-email" type="email" className="mq-input" autoComplete="email" value={email} disabled={decline.isPending} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="mq-auth-field">
            <label htmlFor="decline-code">{t("subAccounts.decline.code")}</label>
            <input id="decline-code" className="mq-input" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} disabled={decline.isPending} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button type="submit" className="mq-btn mq-btn-primary" disabled={decline.isPending}>
            {decline.isPending ? t("admin.common.working") : t("subAccounts.decline.submit")}
          </button>
        </form>
      )}
    </AuthPanel>
  );
}
