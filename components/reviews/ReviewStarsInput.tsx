"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ReviewStarsInput({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
}) {
  const { t } = useLanguage();
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label={t("product.reviewsPage.rating")}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className="p-0.5 text-mq-gold"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          <Star
            size={size}
            fill={n <= shown ? "currentColor" : "none"}
            strokeWidth={n <= shown ? 0 : 1.5}
            className={n <= shown ? "text-mq-gold" : "text-mq-border"}
          />
        </button>
      ))}
    </div>
  );
}
