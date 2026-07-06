"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function LostPasswordContent() {
  const { t } = useLanguage();

  return (
    <>
      <PageHero
        title={t("account.lostPasswordTitle")}
        breadcrumb={[
          { label: t("nav.account"), href: "/my-account" },
          { label: t("account.lostPasswordTitle") },
        ]}
      />
      <Container className="py-12 md:py-16 max-w-md mx-auto">
        <p className="text-mq-text-secondary mb-6">{t("account.lostPasswordDesc")}</p>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("account.username")}</label>
            <input type="text" className="w-full border border-mq-border bg-mq-surface px-4 py-2.5 text-sm outline-none focus:border-mq-primary" />
          </div>
          <button type="submit" className="mq-btn mq-btn-primary w-full">
            {t("account.resetPassword")}
          </button>
        </form>
        <Link
          href="/my-account"
          className="block mt-4 text-sm text-center text-mq-text-muted hover:text-mq-text"
        >
          {t("account.backToLogin")}
        </Link>
      </Container>
    </>
  );
}
