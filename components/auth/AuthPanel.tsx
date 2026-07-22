import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthPanelProps = {
  title: string;
  description?: string;
  asideTitle?: string;
  asideText?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Auth shell — 2/3 viewport, centered, split brand + form. */
export function AuthPanel({
  title,
  description,
  asideTitle = "MQ Shop",
  asideText = "Soft essentials for everyday routines.",
  children,
  footer,
}: AuthPanelProps) {
  return (
    <section className="mq-auth-page">
      <div className="mq-auth-panel">
        <aside className="mq-auth-aside">
          <Image
            src="/images/hero/promo1.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 900px) 33vw, 66vw"
            className="mq-auth-aside-image object-cover"
          />
          <div className="mq-auth-aside-veil" />
          <div className="mq-auth-aside-copy">
            <Link href="/" className="mq-auth-mark" aria-label="MQ home">
              MQ
            </Link>
            <p className="mq-auth-aside-title">{asideTitle}</p>
            <p className="mq-auth-aside-text">{asideText}</p>
          </div>
        </aside>

        <div className="mq-auth-main">
          <header className="mq-auth-header">
            <p className="mq-auth-kicker">Account</p>
            <h1 className="mq-auth-title">{title}</h1>
            {description ? <p className="mq-auth-desc">{description}</p> : null}
          </header>

          <div className="mq-auth-body">{children}</div>

          {footer ? <footer className="mq-auth-footer">{footer}</footer> : null}
        </div>
      </div>
    </section>
  );
}
