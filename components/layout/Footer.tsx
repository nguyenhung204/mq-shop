"use client";

import Link from "next/link";
import { footerColumns } from "@/lib/data/navigation";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-mq-footer text-white mt-auto">
      <div className="mq-container py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          {footerColumns.map((col) => (
            <div key={col.titleKey}>
              <h4 className="text-lg mb-5 font-normal">{t(`footer.${col.titleKey}`)}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/70 hover:text-white transition-colors"
                    >
                      {t(`footer.${link.key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4 className="text-lg mb-5 font-normal">{t("footer.newsletter")}</h4>
            <p className="text-sm text-white/70 mb-4">{t("footer.newsletterDesc")}</p>
            <form className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              <input
                type="email"
                placeholder={t("footer.emailPlaceholder")}
                className="flex-1 bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/50 rounded-full sm:rounded-l-full sm:rounded-r-none outline-none focus:border-white/40"
              />
              <button
                type="submit"
                className="bg-white text-black px-5 py-2.5 text-sm font-medium rounded-full sm:rounded-r-full sm:rounded-l-none hover:bg-white/90 transition-colors shrink-0"
              >
                {t("footer.subscribe")}
              </button>
            </form>
            <div className="flex gap-4 mt-6">
              {["Facebook", "X", "Instagram", "Pinterest"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-wider"
                >
                  {social[0]}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mq-container py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <p>{t("footer.copyright")}</p>
          <div className="flex items-center gap-3 text-xs">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>Amex</span>
            <span>PayPal</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
