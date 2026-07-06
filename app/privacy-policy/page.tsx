import { Container, PageHero } from "@/components/ui/shared";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHero title="Privacy Policy" breadcrumb={[{ label: "Privacy Policy" }]} />
      <Container className="py-12 md:py-20 max-w-3xl">
        <div className="space-y-6 text-mq-text-secondary text-sm leading-relaxed">
          <p>Last updated: July 2026</p>
          <h2 className="text-xl text-mq-text font-display">Introduction</h2>
          <p>
            MQ (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) respects your privacy and is
            committed to protecting your personal data. This privacy policy explains
            how we collect, use, and safeguard your information when you visit our
            website or make a purchase.
          </p>
          <h2 className="text-xl text-mq-text font-display">Information We Collect</h2>
          <p>
            We may collect personal information including your name, email address,
            shipping address, payment information, and browsing behavior on our site.
          </p>
          <h2 className="text-xl text-mq-text font-display">How We Use Your Information</h2>
          <p>
            We use your information to process orders, communicate with you about
            your purchases, improve our services, and send marketing communications
            (with your consent).
          </p>
          <h2 className="text-xl text-mq-text font-display">Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect
            your personal data against unauthorized access, alteration, or destruction.
          </p>
          <h2 className="text-xl text-mq-text font-display">Your Rights</h2>
          <p>
            You have the right to access, correct, or delete your personal data.
            Contact us at privacy@mq.com to exercise these rights.
          </p>
          <h2 className="text-xl text-mq-text font-display">Contact</h2>
          <p>
            For questions about this privacy policy, please contact us at
            privacy@mq.com.
          </p>
        </div>
      </Container>
    </>
  );
}
