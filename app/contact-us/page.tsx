"use client";

import { Container, PageHero } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function ContactPage() {
  const { t } = useLanguage();

  return (
    <>
      <PageHero title={t("contactPage.title")} breadcrumb={[{ label: t("contactPage.title") }]} />
      <Container className="py-12 md:py-20">
        <h2 className="text-2xl md:text-3xl text-mq-text text-center mb-12">
          {t("contactPage.getInTouch")}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <form className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("contactPage.yourName")}</label>
              <input
                type="text"
                className="w-full border border-mq-border bg-mq-surface px-4 py-3 text-sm outline-none focus:border-mq-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("contactPage.yourEmail")}</label>
              <input
                type="email"
                className="w-full border border-mq-border bg-mq-surface px-4 py-3 text-sm outline-none focus:border-mq-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("contactPage.yourMessage")}</label>
              <textarea
                rows={6}
                className="w-full border border-mq-border bg-mq-surface px-4 py-3 text-sm outline-none focus:border-mq-primary resize-none"
              />
            </div>
            <button type="submit" className="mq-btn mq-btn-primary">
              {t("contactPage.sendMessage")}
            </button>
          </form>
          <div className="space-y-8">
            {([
              {
                title: t("contactPage.address"),
                content: t("contactPage.addressContent"),
              },
              {
                title: t("contactPage.phone"),
                content: t("contactPage.phoneContent"),
              },
              {
                title: t("contactPage.email"),
                content: t("contactPage.emailContent"),
              },
              {
                title: t("contactPage.hours"),
                content: t("contactPage.hoursContent"),
              },
            ]).map((item) => (
              <div key={item.title}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-mq-text mb-2">
                  {item.title}
                </h3>
                <p className="text-mq-text-secondary whitespace-pre-line text-sm">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
