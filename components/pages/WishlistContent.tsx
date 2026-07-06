"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";

export function WishlistContent() {
  const { t } = useLanguage();

  return (
    <>
      <PageHero title={t("nav.wishlist")} breadcrumb={[{ label: t("nav.wishlist") }]} />
      <Container className="py-16 md:py-24 text-center">
        <div className="max-w-md mx-auto">
          <svg
            className="w-16 h-16 mx-auto text-mq-text-muted mb-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <h2 className="text-xl text-mq-text mb-3">{t("wishlist.emptyTitle")}</h2>
          <p className="text-mq-text-secondary mb-8">{t("wishlist.emptyDesc")}</p>
          <Link href="/shop" className="mq-btn mq-btn-primary">
            {t("wishlist.browse")}
          </Link>
        </div>
      </Container>
    </>
  );
}
