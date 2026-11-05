"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { footerColumns } from "@/lib/data/navigation";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function Footer() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error(t("footer.invalidEmail") || "Please enter a valid email address.");
      return;
    }
    toast.success(t("footer.subscribedSuccess") || "Thank you for subscribing to MQ!");
    setEmail("");
  };

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
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("footer.emailPlaceholder")}
                className="flex-1 bg-white/10 border border-white/20 px-4 py-2.5 text-sm text-white placeholder:text-white/50 rounded-full sm:rounded-l-full sm:rounded-r-none outline-none focus:border-white/40"
                required
              />
              <button
                type="submit"
                className="bg-white text-black px-5 py-2.5 text-sm font-medium rounded-full sm:rounded-r-full sm:rounded-l-none hover:bg-white/90 transition-colors shrink-0"
              >
                {t("footer.subscribe")}
              </button>
            </form>
            <div className="flex gap-4 mt-6 items-center">
              {[
                {
                  name: "Facebook",
                  href: "https://facebook.com",
                  icon: (
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  ),
                },
                {
                  name: "X",
                  href: "https://x.com",
                  icon: (
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  ),
                },
                {
                  name: "Instagram",
                  href: "https://instagram.com",
                  icon: (
                    <svg className="w-4 h-4 fill-none stroke-current" strokeWidth={2} viewBox="0 0 24 24">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  ),
                },
                {
                  name: "Pinterest",
                  href: "https://pinterest.com",
                  icon: (
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0a12 12 0 00-4.37 23.18c-.07-.98-.13-2.48.03-3.55l1.03-4.35s-.26-.53-.26-1.32c0-1.24.72-2.16 1.61-2.16.76 0 1.13.57 1.13 1.26 0 .76-.49 1.91-.74 2.97-.21.89.44 1.61 1.32 1.61 1.58 0 2.8-1.67 2.8-4.08 0-2.13-1.53-3.62-3.72-3.62-2.53 0-4.02 1.9-4.02 3.86 0 .77.29 1.59.66 2.04.07.09.08.17.06.26l-.25 1.01c-.04.16-.14.2-.31.12-1.16-.54-1.88-2.23-1.88-3.59 0-2.92 2.12-5.61 6.13-5.61 3.22 0 5.72 2.29 5.72 5.36 0 3.2-2.02 5.77-4.82 5.77-.94 0-1.83-.49-2.13-1.07l-.58 2.22c-.21.81-.78 1.83-1.16 2.45A11.98 11.98 0 0012 24c6.63 0 12-5.37 12-12S18.63 0 12 0z" />
                    </svg>
                  ),
                },
              ].map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white/70 hover:text-white transition-all duration-200 hover:scale-110"
                  aria-label={social.name}
                >
                  {social.icon}
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
