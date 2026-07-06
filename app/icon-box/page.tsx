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

const boxes: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Truck,
    title: "Free Shipping",
    desc: "Complimentary shipping on all orders over $75. Fast and reliable delivery to your door.",
  },
  {
    icon: Lock,
    title: "Secure Payment",
    desc: "Your payment information is encrypted and processed through trusted payment gateways.",
  },
  {
    icon: Undo2,
    title: "Easy Returns",
    desc: "Not satisfied? Return within 14 days for a full refund. No questions asked.",
  },
  {
    icon: MessageCircle,
    title: "24/7 Support",
    desc: "Our customer support team is available around the clock to assist you.",
  },
  {
    icon: Sparkles,
    title: "Premium Quality",
    desc: "Every item is inspected and verified before it reaches your hands.",
  },
  {
    icon: Gift,
    title: "Gift Ready",
    desc: "Beautiful MQ packaging included with every order. Perfect for gifting.",
  },
];

export default function IconBoxPage() {
  return (
    <>
      <PageHero title="Icon Box" breadcrumb={[{ label: "Icon Box" }]} />
      <Container className="py-12 md:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {boxes.map((box) => {
            const Icon = box.icon;
            return (
              <div
                key={box.title}
                className="p-8 border border-mq-border text-center hover:border-mq-text-muted transition-colors group"
              >
                <Icon
                  className="w-10 h-10 mx-auto mb-5 text-mq-text group-hover:scale-110 transition-transform"
                  strokeWidth={1.5}
                />
                <h3 className="text-lg text-mq-text mb-2">{box.title}</h3>
                <p className="text-sm text-mq-text-secondary">{box.desc}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </>
  );
}
