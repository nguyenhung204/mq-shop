"use client";

import { useCallback, useMemo } from "react";
import type { ApiCategory } from "@/lib/api/types";
import { categoryLabel } from "@/lib/api/categoryLabel";
import type { Locale } from "@/lib/i18n/types";
import { CategoryCard } from "@/components/ui/ProductCard";

type Props = {
  categories: ApiCategory[];
  locale: Locale | null;
  imageFor: (slug: string) => string;
};

function CategoryChip({
  cat,
  locale,
  image,
  priority,
}: {
  cat: ApiCategory;
  locale: Locale | null;
  image: string;
  priority?: boolean;
}) {
  return (
    <CategoryCard
      name={locale ? categoryLabel(cat, locale) : cat.name || cat.slug}
      slug={cat.id}
      image={image}
      priority={priority}
    />
  );
}

/**
 * Infinite right→left marquee for homepage categories.
 * Always on when there is at least one category (duplicated enough to fill the strip).
 */
export function CategoryMarquee({ categories, locale, imageFor }: Props) {
  const resolveImage = useCallback((slug: string) => imageFor(slug), [imageFor]);

  // Repeat base set so one half of the track is always wider than the viewport.
  const repeats = useMemo(() => {
    if (categories.length === 0) return 1;
    if (categories.length >= 8) return 2;
    if (categories.length >= 4) return 3;
    return 4;
  }, [categories.length]);

  const sequence = useMemo(() => {
    const out: ApiCategory[] = [];
    for (let r = 0; r < repeats; r++) {
      out.push(...categories);
    }
    return out;
  }, [categories, repeats]);

  if (categories.length === 0) return null;

  // Single row, no loop needed
  if (categories.length === 1) {
    return (
      <div className="mq-carousel-track mq-category-static">
        <CategoryChip
          cat={categories[0]!}
          locale={locale}
          image={resolveImage(categories[0]!.slug)}
          priority
        />
      </div>
    );
  }

  return (
    <div className="mq-category-marquee" aria-label="Categories">
      <div className="mq-category-marquee-track">
        <div className="mq-category-marquee-group">
          {sequence.map((cat, i) => (
            <CategoryChip
              key={`a-${cat.id}-${i}`}
              cat={cat}
              locale={locale}
              image={resolveImage(cat.slug)}
              priority={i < 4}
            />
          ))}
        </div>
        <div className="mq-category-marquee-group" aria-hidden="true">
          {sequence.map((cat, i) => (
            <CategoryChip
              key={`b-${cat.id}-${i}`}
              cat={cat}
              locale={locale}
              image={resolveImage(cat.slug)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
