import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getProductBySlug, products, formatPrice } from "@/lib/data/products";
import { ProductCard } from "@/components/ui/ProductCard";
import { ProductActions } from "@/components/cart/ProductActions";
import { Container, PageHero, Stars } from "@/components/ui/shared";

export async function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };
  return { title: product.name };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const related = products
    .filter((p) => p.categorySlug === product.categorySlug && p.id !== product.id)
    .slice(0, 5);

  return (
    <>
      <PageHero
        title={product.name}
        breadcrumb={[
          { label: "Shop", href: "/shop" },
          { label: product.category, href: `/shop?category=${product.categorySlug}` },
          { label: product.name },
        ]}
      />
      <Container className="py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          <div className="relative aspect-[4/5] bg-mq-surface-subtle overflow-hidden">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width:1024px) 100vw, 50vw"
              priority
            />
            {product.salePercent && (
            <span className="absolute top-4 left-4 mq-sale-badge">
              -{product.salePercent}%
            </span>
            )}
          </div>

          <div>
            <div className="flex gap-3 mb-4 text-xs">
              <span className="mq-badge mq-badge-teal">100% Original</span>
              <span className="mq-badge mq-badge-teal">Best Price</span>
              <span className="mq-badge mq-badge-teal">Free Shipping</span>
            </div>
            <p className="text-xs text-mq-text-muted uppercase tracking-[0.15em] mb-2">
              {product.brand}
            </p>
            <h1 className="text-2xl md:text-[26px] font-sans text-mq-text mb-3">
              {product.name}
            </h1>
            <div className="flex items-center gap-3 mb-4">
              <Stars rating={product.rating} />
              <span className="text-sm text-mq-text-muted">
                ({product.reviewCount} reviews)
              </span>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl font-medium">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <span className="text-lg text-mq-text-muted line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            <p className="text-sm text-mq-text-secondary mb-4">
              <span className="text-mq-accent-orange font-medium">12 sold</span> in last hour ·{" "}
              <span className="text-mq-accent-orange font-medium">8 people</span> viewing
            </p>

            <ul className="space-y-2 mb-6 text-sm text-mq-text-secondary">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-mq-gold mt-0.5 shrink-0" strokeWidth={2} />
                  {f}
                </li>
              ))}
            </ul>

            {product.salePercent && (
              <div className="bg-mq-surface-subtle p-4 mb-6 text-sm">
                <p className="font-medium text-mq-accent-orange mb-1">Sale ends soon!</p>
                <p className="text-mq-text-muted">02d : 14h : 32m : 18s</p>
              </div>
            )}

            <ProductActions product={product} />

            <div className="flex gap-6 text-sm text-mq-text-secondary mb-8">
              <button type="button" className="hover:text-mq-text">Compare</button>
              <Link href="/wishlist" className="hover:text-mq-text">Wishlist</Link>
              <button type="button" className="hover:text-mq-text">Ask us</button>
            </div>

            <div className="border-t border-mq-border pt-6 space-y-3 text-sm text-mq-text-secondary">
              <p>Estimated delivery: 3–5 business days</p>
              <p>Free shipping on orders over $75</p>
              <p className="text-xs text-mq-text-muted">
                Guaranteed safe and secure checkout
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-16 border-t border-mq-border pt-10">
          <div className="flex gap-8 border-b border-mq-border mb-8 overflow-x-auto">
            {["Description", "Additional Info", "Reviews", "Shipping & Return"].map(
              (tab, i) => (
                <button
                  key={tab}
                  type="button"
                  className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${i === 0 ? "border-mq-gold text-mq-text" : "border-transparent text-mq-text-muted hover:text-mq-text"}`}
                >
                  {tab}
                </button>
              ),
            )}
          </div>
          <div className="prose prose-sm max-w-none text-mq-text-secondary">
            <p>{product.description}</p>
            <p className="mt-4">
              Stock: {product.inStock} units available. SKU: MQ-{product.id.padStart(4, "0")}
            </p>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl md:text-3xl text-mq-text mb-8">You may also like</h2>
            <div className="mq-carousel pb-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
