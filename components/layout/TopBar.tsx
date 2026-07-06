"use client";

import Link from "next/link";
import { topBarLinks } from "@/lib/data/navigation";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function TopBar() {
  const { t } = useLanguage();

  return (
    <div className="bg-black text-white text-sm h-10 flex items-center overflow-hidden">
      <div className="mq-container flex items-center justify-between w-full gap-2 min-w-0">
        <p className="hidden sm:block text-xs md:text-sm truncate min-w-0">{t("topBar.promo")}</p>
        <p className="sm:hidden text-xs truncate min-w-0 flex-1">{t("topBar.promoShort")}</p>
        <nav className="flex items-center gap-3 sm:gap-4 md:gap-6 shrink-0">
          {topBarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs md:text-sm hover:text-white/70 transition-colors whitespace-nowrap"
            >
              {t(`nav.${link.key}`)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
