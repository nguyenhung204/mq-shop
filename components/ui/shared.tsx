import Link from "next/link";
import { Star } from "lucide-react";
import { ReactNode } from "react";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mq-container ${className}`}>{children}</div>;
}

export function SectionHeading({
  label,
  title,
  action,
  centered = true,
}: {
  label?: string;
  title: string;
  action?: { label: string; href: string };
  centered?: boolean;
}) {
  if (centered) {
    return (
      <div className="mq-section-head">
        {label && <span className="mq-section-label">{label}</span>}
        <h2 className="mq-section-title">{title}</h2>
        {action && (
          <Link
            href={action.href}
            className="mq-btn mq-btn-outline text-xs mt-6 inline-flex"
          >
            {action.label}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
      <div>
        {label && <span className="mq-section-label">{label}</span>}
        <h2 className="mq-section-title text-left">{title}</h2>
      </div>
      {action && (
        <Link href={action.href} className="mq-btn mq-btn-outline text-xs shrink-0">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function PageHero({
  title,
  breadcrumb,
}: {
  title: string;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <div className="bg-mq-surface-subtle border-b border-mq-border py-10 md:py-14">
      <Container>
        {breadcrumb && (
          <nav className="flex items-center gap-2 text-xs text-mq-text-muted mb-3 uppercase tracking-wider">
            <Link href="/" className="hover:text-mq-text transition-colors">
              Home
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
        <h1 className="text-3xl md:text-[40px] text-mq-text tracking-wide">{title}</h1>
      </Container>
    </div>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-px" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={i < Math.floor(rating) ? "text-mq-gold" : "text-mq-border"}
          fill={i < Math.floor(rating) ? "currentColor" : "none"}
          strokeWidth={i < Math.floor(rating) ? 0 : 1.5}
        />
      ))}
    </div>
  );
}
