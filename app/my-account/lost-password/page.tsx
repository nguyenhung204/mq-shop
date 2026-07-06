import Link from "next/link";
import { Container, PageHero } from "@/components/ui/shared";

export const metadata = { title: "Lost Password" };

export default function LostPasswordPage() {
  return (
    <>
      <PageHero
        title="Lost Password"
        breadcrumb={[
          { label: "My Account", href: "/my-account" },
          { label: "Lost Password" },
        ]}
      />
      <Container className="py-12 md:py-16 max-w-md mx-auto">
        <p className="text-mq-text-secondary mb-6">
          Lost your password? Please enter your username or email address. You
          will receive a link to create a new password via email.
        </p>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Username or email
            </label>
            <input
              type="text"
              className="w-full border border-mq-border bg-mq-surface px-4 py-2.5 text-sm outline-none focus:border-mq-primary"
            />
          </div>
          <button type="submit" className="mq-btn mq-btn-primary w-full">
            Reset password
          </button>
        </form>
        <Link
          href="/my-account"
          className="block mt-4 text-sm text-center text-mq-text-muted hover:text-mq-text"
        >
          Back to login
        </Link>
      </Container>
    </>
  );
}
