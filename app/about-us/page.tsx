"use client";

import Image from "next/image";
import Link from "next/link";
import { ClipboardList, Mail, Sparkles, type LucideIcon } from "lucide-react";
import { miscImages } from "@/lib/images";
import { Container, PageHero } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function AboutPage() {
  const { t } = useLanguage();

  const counters = [
    { value: "12+", label: t("aboutPage.yearsExp") },
    { value: "50+", label: t("aboutPage.teamMembers") },
    { value: "2M+", label: t("aboutPage.happyCustomers") },
    { value: "15+", label: t("aboutPage.designAwards") },
  ];

  const iconBoxes: { icon: LucideIcon; title: string; desc: string }[] = [
    {
      icon: ClipboardList,
      title: t("aboutPage.submitTask"),
      desc: t("aboutPage.submitTaskDesc"),
    },
    {
      icon: Mail,
      title: t("aboutPage.sendMessage"),
      desc: t("aboutPage.sendMessageDesc"),
    },
    {
      icon: Sparkles,
      title: t("aboutPage.trustedExperience"),
      desc: t("aboutPage.trustedExperienceDesc"),
    },
  ];

  return (
    <>
      <PageHero title={t("aboutPage.title")} breadcrumb={[{ label: t("aboutPage.title") }]} />
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
              {t("aboutPage.ourStory")}
            </span>
            <h2 className="text-3xl md:text-[44px] text-mq-text mt-2 mb-6">
              {t("aboutPage.heading")}
            </h2>
            <p className="text-mq-text-secondary leading-relaxed mb-4">
              {t("aboutPage.paragraph1")}
            </p>
            <p className="text-mq-text-secondary leading-relaxed">
              {t("aboutPage.paragraph2")}
            </p>
          </div>
        </div>

        <div className="text-center mb-20">
          <h2 className="text-2xl md:text-3xl text-mq-text mb-4">
            {t("aboutPage.inspirationTitle")}
          </h2>
          <p className="text-mq-text-secondary max-w-2xl mx-auto">
            {t("aboutPage.inspirationDesc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {[
            {
              title: t("aboutPage.vision"),
              text: t("aboutPage.visionText"),
            },
            {
              title: t("aboutPage.mission"),
              text: t("aboutPage.missionText"),
            },
            {
              title: t("aboutPage.support"),
              text: t("aboutPage.supportText"),
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
            {t("aboutPage.wantToKnowMore")}
          </h2>
          <p className="text-mq-text-secondary mb-6">
            {t("aboutPage.weLoveToHear")}
          </p>
          <Link href="/contact-us" className="mq-btn mq-btn-primary">
            {t("aboutPage.contactUs")}
          </Link>
        </div>
      </Container>
    </>
  );
}
