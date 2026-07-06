"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function MyAccountContent() {
  const { t } = useLanguage();

  return (
    <>
      <PageHero title={t("nav.account")} breadcrumb={[{ label: t("nav.account") }]} />
      <Container className="py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
          <div>
            <h2 className="text-xl text-mq-text mb-6">{t("account.login")}</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{t("account.username")}</label>
                <input type="text" className="w-full border border-mq-border bg-mq-surface px-4 py-2.5 text-sm outline-none focus:border-mq-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t("account.password")}</label>
                <input type="password" className="w-full border border-mq-border bg-mq-surface px-4 py-2.5 text-sm outline-none focus:border-mq-primary" />
              </div>
              <label className="flex items-center gap-2 text-sm text-mq-text-secondary">
                <input type="checkbox" /> {t("account.rememberMe")}
              </label>
              <button type="submit" className="mq-btn mq-btn-primary w-full">
                {t("account.logIn")}
              </button>
              <Link
                href="/my-account/lost-password"
                className="block text-sm text-mq-text-muted hover:text-mq-text text-center"
              >
                {t("account.lostPassword")}
              </Link>
            </form>
          </div>
          <div>
            <h2 className="text-xl text-mq-text mb-6">{t("account.register")}</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{t("account.emailAddress")}</label>
                <input type="email" className="w-full border border-mq-border bg-mq-surface px-4 py-2.5 text-sm outline-none focus:border-mq-primary" />
              </div>
              <p className="text-xs text-mq-text-muted">{t("account.registerNote")}</p>
              <button type="submit" className="mq-btn mq-btn-outline w-full">
                {t("account.register")}
              </button>
            </form>
          </div>
        </div>
      </Container>
    </>
  );
}
