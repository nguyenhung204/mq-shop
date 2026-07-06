import { Container, PageHero } from "@/components/ui/shared";

export const metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <>
      <PageHero title="Contact Us" breadcrumb={[{ label: "Contact Us" }]} />
      <Container className="py-12 md:py-20">
        <h2 className="text-2xl md:text-3xl text-mq-text text-center mb-12">
          Get In Touch With Us
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <form className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">Your Name</label>
              <input
                type="text"
                className="w-full border border-mq-border bg-mq-surface px-4 py-3 text-sm outline-none focus:border-mq-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Your Email</label>
              <input
                type="email"
                className="w-full border border-mq-border bg-mq-surface px-4 py-3 text-sm outline-none focus:border-mq-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Your Message</label>
              <textarea
                rows={6}
                className="w-full border border-mq-border bg-mq-surface px-4 py-3 text-sm outline-none focus:border-mq-primary resize-none"
              />
            </div>
            <button type="submit" className="mq-btn mq-btn-primary">
              Send Message
            </button>
          </form>
          <div className="space-y-8">
            {[
              {
                title: "Address",
                content: "123 MQ Street, Design District\nNew York, NY 10001",
              },
              {
                title: "Phone",
                content: "+1 (555) 123-4567",
              },
              {
                title: "Email",
                content: "hello@mq.com",
              },
              {
                title: "Hours",
                content: "Mon – Fri: 9am – 6pm EST\nSat: 10am – 4pm EST",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-mq-text mb-2">
                  {item.title}
                </h3>
                <p className="text-mq-text-secondary whitespace-pre-line text-sm">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
