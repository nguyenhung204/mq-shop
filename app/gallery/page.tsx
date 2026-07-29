"use client";

import Image from "next/image";
import Link from "next/link";
import { ZoomIn } from "lucide-react";
import { galleryImages } from "@/lib/images";
import { Container, PageHero } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function GalleryPage() {
  const { t } = useLanguage();

  return (
    <>
      <PageHero title={t("galleryPage.title")} breadcrumb={[{ label: t("galleryPage.title") }]} />
      <Container className="py-12 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {galleryImages.map((src, i) => (
            <div
              key={i}
              className="relative aspect-square overflow-hidden bg-mq-surface-subtle group cursor-pointer"
            >
              <Image
                src={src}
                alt={t("galleryPage.imageAlt", { n: String(i + 1) })}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width:768px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn
                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  size={28}
                  strokeWidth={1.5}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link href="/shop" className="mq-btn mq-btn-primary">
            {t("galleryPage.viewMore")}
          </Link>
        </div>
      </Container>
    </>
  );
}
