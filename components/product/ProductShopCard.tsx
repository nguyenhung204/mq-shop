"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

type ShopInfo = {
  id: string;
  name: string;
  logoUrl?: string | null;
};

export function ProductShopCard({ shop }: { shop: ShopInfo }) {
  const { t } = useLanguage();
  const href = `/shops/${shop.id}`;

  return (
    <Link href={href} className="mq-shop-card group">
      <div className="mq-shop-card-logo">
        {shop.logoUrl ? (
          <Image
            src={shop.logoUrl}
            alt=""
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <Store size={22} strokeWidth={1.5} className="text-mq-text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mq-text-muted mb-0.5">
          {t("product.soldBy")}
        </p>
        <p className="text-sm font-medium text-mq-text truncate group-hover:text-mq-gold transition-colors">
          {shop.name}
        </p>
        <p className="text-xs text-mq-text-secondary mt-0.5">
          {t("product.visitShop")}
        </p>
      </div>
      <span className="mq-shop-card-cta" aria-hidden>
        <ArrowUpRight size={16} strokeWidth={1.75} />
      </span>
    </Link>
  );
}
