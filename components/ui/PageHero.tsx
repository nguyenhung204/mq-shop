"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container } from "@/components/ui/shared";

export function PageHero({
  title,
  breadcrumb,
}: {
  title: string;
  breadcrumb?: { label: string; href?: string }[];
}) {
  const { t } = useLanguage();

  return (
    <div className="bg-mq-surface-subtle border-b border-mq-border py-10 md:py-14">
      <Container>
        {breadcrumb && (
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mq-text-muted mb-3 uppercase tracking-wider">
            <Link href="/" className="hover:text-mq-text transition-colors">
              {t("nav.home")}
            </Link>
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                <span>/</span>
                {item.href ? (
                  <Link href={item.href} className="hover:text-mq-text transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-mq-text">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl sm:text-3xl md:text-[40px] text-mq-text tracking-wide">{title}</h1>
      </Container>
    </div>
  );
}
