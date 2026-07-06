import Image from "next/image";
import Link from "next/link";
import { ClipboardList, Mail, Sparkles, type LucideIcon } from "lucide-react";
import { miscImages } from "@/lib/images";
import { Container, PageHero } from "@/components/ui/shared";

export const metadata = { title: "About Us" };

const counters = [
  { value: "12+", label: "Years of Experience" },
  { value: "50+", label: "Team Members" },
  { value: "2M+", label: "Happy Customers" },
  { value: "15+", label: "Design Awards" },
];

const iconBoxes: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: ClipboardList,
    title: "Submit a Task",
    desc: "Tell us what you're looking for and our curators will find it.",
  },
  {
    icon: Mail,
    title: "Send a Message",
    desc: "Reach out anytime — we respond within 24 hours.",
  },
  {
    icon: Sparkles,
    title: "Trusted Experience",
    desc: "Over a decade of curating quality goods for modern living.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero title="About Us" breadcrumb={[{ label: "About Us" }]} />
      <Container className="py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
          <div className="relative aspect-[4/3] bg-mq-surface-subtle overflow-hidden">
            <Image
              src={miscImages.about}
              alt="MQ Studio"
              fill
              className="object-cover"
              sizes="(max-width:1024px) 100vw, 50vw"
            />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-mq-text-muted">
              Our Story
            </span>
            <h2 className="text-3xl md:text-[44px] text-mq-text mt-2 mb-6">
              Curating Quality for Modern Living
            </h2>
            <p className="text-mq-text-secondary leading-relaxed mb-4">
              MQ was founded on a simple belief: everyday objects should be
              beautiful, functional, and built to last. We hand-select every item
              in our collection — from accessories and apparel to home goods
              and tech essentials.
            </p>
            <p className="text-mq-text-secondary leading-relaxed">
              Our team travels the world to discover makers and brands that share
              our commitment to craftsmanship, sustainability, and thoughtful design.
            </p>
          </div>
        </div>

        <div className="text-center mb-20">
          <h2 className="text-2xl md:text-3xl text-mq-text mb-4">
            Inspiration, Innovation, and Opportunities
          </h2>
          <p className="text-mq-text-secondary max-w-2xl mx-auto">
            We believe great design should be accessible. MQ bridges the gap
            between premium quality and everyday affordability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            {
              title: "Vision",
              text: "To be the most trusted destination for curated lifestyle goods worldwide.",
            },
            {
              title: "Mission",
              text: "To connect people with products that elevate their daily experience.",
            },
            {
              title: "Support",
              text: "Dedicated customer care, hassle-free returns, and transparent sourcing.",
            },
          ].map((item) => (
            <div key={item.title} className="border border-mq-border p-8">
              <h3 className="text-lg font-semibold text-mq-text mb-3">
                {item.title}
              </h3>
              <p className="text-sm text-mq-text-secondary">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {iconBoxes.map((box) => {
            const Icon = box.icon;
            return (
            <div key={box.title} className="text-center p-8 bg-mq-surface-subtle">
              <Icon className="w-10 h-10 mx-auto mb-4 text-mq-text" strokeWidth={1.5} />
              <h3 className="text-lg text-mq-text mb-2">{box.title}</h3>
              <p className="text-sm text-mq-text-secondary">{box.desc}</p>
            </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {counters.map((c) => (
            <div key={c.label} className="text-center py-8 border border-mq-border">
              <p className="text-3xl md:text-4xl text-mq-text font-display mb-2">
                {c.value}
              </p>
              <p className="text-sm text-mq-text-muted">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-mq-surface-subtle p-10 md:p-16 text-center">
          <h2 className="text-2xl md:text-3xl text-mq-text mb-4">
            Want to know more?
          </h2>
          <p className="text-mq-text-secondary mb-6">
            We&apos;d love to hear from you.
          </p>
          <Link href="/contact-us" className="mq-btn mq-btn-primary">
            Contact Us
          </Link>
        </div>
      </Container>
    </>
  );
}
