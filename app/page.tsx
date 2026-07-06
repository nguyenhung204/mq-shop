import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { categories } from "@/lib/data/categories";
import { products } from "@/lib/data/products";
import { heroImages, miscImages } from "@/lib/images";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategoryCard } from "@/components/ui/ProductCard";
import { ProductCarousel } from "@/components/ui/ProductCarousel";
import { Container, SectionHeading } from "@/components/ui/shared";

const trustIcons = [
  { title: "Flexible Payment", desc: "Split payments with Klarna or Afterpay at checkout." },
  { title: "Best Online Support", desc: "Dedicated support team available 7 days a week." },
  { title: "14 Day Returns", desc: "Hassle-free returns within 14 days of delivery." },
  { title: "Premium Quality", desc: "Every item is hand-selected for lasting quality." },
];

const testimonials = [
  { quote: "MQ has completely changed how I shop online. Every piece feels intentional and well-made.", name: "Sarah M.", date: "May 2026", rating: 5 },
  { quote: "Beautiful products, fast shipping, and excellent service.", name: "James L.", date: "April 2026", rating: 5 },
  { quote: "Finally a brand that understands quality over quantity.", name: "Elena K.", date: "March 2026", rating: 5 },
];

export default function HomePage() {
  const saleProducts = products.filter((p) => p.salePercent);
  const newProducts = products.filter((p) => p.badge === "new");
  const hotProducts = products.filter((p) => p.badge === "hot");

  return (
    <>
      <HeroSlider />

      <section className="py-14 md:py-20">
        <Container>
          <div className="mq-carousel-track">
            {categories.map((cat) => (
              <CategoryCard key={cat.slug} name={cat.name} slug={cat.slug} image={cat.image} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-14 md:py-20 bg-mq-surface-subtle">
        <Container>
          <SectionHeading label="Season Sale" title="FOR EVERY MOMENT" action={{ label: "Shop All", href: "/shop?sort=deals" }} />
          <ProductCarousel products={saleProducts} />
        </Container>
      </section>

      <section className="py-8">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { title: "TIMELESS DESIGN", image: heroImages.promo1 },
              { title: "THOUGHTFUL GIFTS", image: heroImages.promo2 },
            ].map((banner) => (
              <div key={banner.title} className="relative h-[280px] md:h-[380px] overflow-hidden group">
                <Image src={banner.image} alt={banner.title} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="(max-width:768px) 100vw, 50vw" quality={75} />
                <div className="absolute inset-0 bg-black/35 flex flex-col justify-end p-8">
                  <h3 className="text-2xl md:text-3xl text-white font-display tracking-wide">{banner.title}</h3>
                  <Link href="/shop" className="mq-btn mq-btn-primary mt-4 w-fit text-xs bg-white text-black hover:bg-white/90">Discover Now</Link>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-14 md:py-20">
        <Container>
          <SectionHeading label="Just Arrived" title="NEW AT MQ" action={{ label: "Shop All", href: "/shop?sort=new" }} />
          <ProductCarousel products={newProducts} />
        </Container>
      </section>

      <section className="py-14 md:py-20 bg-mq-surface-subtle">
        <Container>
          <SectionHeading label="Featured" title="CURATED SELECTION" action={{ label: "See Collection", href: "/shop" }} />
          <ProductCarousel products={hotProducts} />
        </Container>
      </section>

      <section className="py-14 md:py-20">
        <Container>
          <SectionHeading label="New Collection" title="STYLE FOR EVERY STORY" />
          <ProductCarousel products={products.slice(0, 6)} />
        </Container>
      </section>

      <section className="py-14 md:py-20 bg-mq-surface-subtle">
        <Container>
          <SectionHeading label="Reviews" title="WHAT CLIENTS SAY" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <blockquote key={t.name} className="bg-mq-surface p-8 border border-mq-border">
                <div className="flex gap-0.5 mb-4 text-mq-gold">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                  ))}
                </div>
                <p className="text-mq-text-secondary text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-5">
                  <p className="text-sm font-medium text-mq-text">{t.name}</p>
                  <time className="text-xs text-mq-text-muted">{t.date}</time>
                </footer>
              </blockquote>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-14 md:py-20">
        <Container>
          <SectionHeading label="Compare" title="SEE THE DIFFERENCE" />
          <div className="relative h-[360px] md:h-[480px] overflow-hidden">
            <div className="absolute inset-0 grid grid-cols-2">
              <div className="relative">
                <Image src={miscImages.compareBefore} alt="Standard" fill className="object-cover" sizes="50vw" quality={75} />
                <span className="absolute top-4 left-4 bg-black text-white text-[10px] px-3 py-1 uppercase tracking-widest">Standard</span>
              </div>
              <div className="relative">
                <Image src={miscImages.compareAfter} alt="MQ Quality" fill className="object-cover" sizes="50vw" quality={75} />
                <span className="absolute top-4 right-4 mq-sale-badge uppercase tracking-widest">MQ Quality</span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-14 md:py-20 border-t border-mq-border">
        <Container>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {trustIcons.map((item) => (
              <div key={item.title}>
                <h4 className="text-sm font-semibold text-mq-text mb-2 uppercase tracking-wider">{item.title}</h4>
                <p className="text-sm text-mq-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
