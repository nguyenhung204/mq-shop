"use client";

import Link from "next/link";
import { topBarLinks } from "@/lib/data/navigation";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function TopBar() {
  const { t } = useLanguage();

  return (
    <div className="mq-topbar">
      <div className="bg-black text-white text-sm h-10 flex items-center overflow-hidden">
        <div className="mq-container flex items-center justify-center w-full min-w-0">
          <p className="hidden sm:block text-xs md:text-sm truncate text-center">
            {t("topBar.promo")}
          </p>
          <p className="sm:hidden text-xs truncate text-center">{t("topBar.promoShort")}</p>
        </div>
      </div>
      <div className="bg-mq-surface-subtle border-b border-mq-border h-9 flex items-center">
        <div className="mq-container flex items-center justify-end w-full">
          <nav className="flex items-center gap-4 sm:gap-6">
            {topBarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[11px] sm:text-xs text-mq-text-secondary hover:text-mq-text transition-colors whitespace-nowrap"
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
