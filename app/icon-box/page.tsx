"use client";

import {
  Gift,
  Lock,
  MessageCircle,
  Sparkles,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Container, PageHero } from "@/components/ui/shared";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function IconBoxPage() {
  const { t } = useLanguage();

  const boxes: { icon: LucideIcon; titleKey: string; descKey: string }[] = [
    { icon: Truck, titleKey: "iconBoxPage.freeShipping", descKey: "iconBoxPage.freeShippingDesc" },
    { icon: Lock, titleKey: "iconBoxPage.securePayment", descKey: "iconBoxPage.securePaymentDesc" },
    { icon: Undo2, titleKey: "iconBoxPage.easyReturns", descKey: "iconBoxPage.easyReturnsDesc" },
    { icon: MessageCircle, titleKey: "iconBoxPage.support247", descKey: "iconBoxPage.support247Desc" },
    { icon: Sparkles, titleKey: "iconBoxPage.premiumQuality", descKey: "iconBoxPage.premiumQualityDesc" },
    { icon: Gift, titleKey: "iconBoxPage.giftReady", descKey: "iconBoxPage.giftReadyDesc" },
  ];

  return (
    <>
      <PageHero title={t("iconBoxPage.title")} breadcrumb={[{ label: t("iconBoxPage.title") }]} />
      <Container className="py-12 md:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {boxes.map((box) => {
            const Icon = box.icon;
            return (
              <div
                key={box.titleKey}
                className="p-8 border border-mq-border text-center hover:border-mq-text-muted transition-colors group"
              >
                <Icon
                  className="w-10 h-10 mx-auto mb-5 text-mq-text group-hover:scale-110 transition-transform"
                  strokeWidth={1.5}
                />
                <h3 className="text-lg text-mq-text mb-2">{t(box.titleKey)}</h3>
                <p className="text-sm text-mq-text-secondary">{t(box.descKey)}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </>
  );
}
