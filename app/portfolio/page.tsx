import Image from "next/image";
import { Check } from "lucide-react";
import { portfolioImages } from "@/lib/images";
import { Container, PageHero } from "@/components/ui/shared";

const highlights = [
  "Award-winning retail design",
  "Sustainable brand initiatives",
  "Global artisan partnerships",
];

const projects = [
  { title: "MQ Flagship Store", category: "Retail" },
  { title: "Spring Collection 2026", category: "Campaign" },
  { title: "Sustainable Packaging", category: "Design" },
  { title: "MQ x Artisan Series", category: "Collaboration" },
  { title: "Digital Experience", category: "Technology" },
  { title: "Holiday Gift Guide", category: "Editorial" },
];

export default function PortfolioPage() {
  return (
    <>
      <PageHero title="Portfolio" breadcrumb={[{ label: "Portfolio" }]} />
      <Container className="py-12 md:py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-mq-text-secondary leading-relaxed mb-4">
            A showcase of MQ projects — from retail experiences to brand
            campaigns and product collaborations.
          </p>
          <ul className="space-y-2 text-sm text-mq-text-secondary">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-mq-gold shrink-0" strokeWidth={2} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <h2 className="text-2xl text-mq-text mb-8">Best of Our Work</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, i) => (
            <article key={project.title} className="group">
              <div className="relative aspect-[4/3] overflow-hidden bg-mq-surface-subtle mb-4">
                <Image
                  src={portfolioImages[i]}
                  alt={project.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width:768px) 100vw, 33vw"
                />
              </div>
              <span className="text-xs text-mq-text-muted uppercase tracking-wider">
                {project.category}
              </span>
              <h3 className="text-lg text-mq-text mt-1 group-hover:text-mq-gold transition-colors">
                {project.title}
              </h3>
            </article>
          ))}
        </div>
      </Container>
    </>
  );
}
