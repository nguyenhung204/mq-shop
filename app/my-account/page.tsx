import Link from "next/link";
import { Container, PageHero } from "@/components/ui/shared";

export const metadata = { title: "My Account" };

export default function MyAccountPage() {
  return (
    <>
      <PageHero title="My Account" breadcrumb={[{ label: "My Account" }]} />
      <Container className="py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
          <div>
            <h2 className="text-xl text-mq-text mb-6">Login</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Username or email</label>
                <input
                  type="text"
                  className="w-full border border-mq-border bg-mq-surface px-4 py-2.5 text-sm outline-none focus:border-mq-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Password</label>
                <input
                  type="password"
                  className="w-full border border-mq-border bg-mq-surface px-4 py-2.5 text-sm outline-none focus:border-mq-primary"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-mq-text-secondary">
                <input type="checkbox" /> Remember me
              </label>
              <button type="submit" className="mq-btn mq-btn-primary w-full">
                Log in
              </button>
              <Link
                href="/my-account/lost-password"
                className="block text-sm text-mq-text-muted hover:text-mq-text text-center"
              >
                Lost your password?
              </Link>
            </form>
          </div>
          <div>
            <h2 className="text-xl text-mq-text mb-6">Register</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email address</label>
                <input
                  type="email"
                  className="w-full border border-mq-border bg-mq-surface px-4 py-2.5 text-sm outline-none focus:border-mq-primary"
                />
              </div>
              <p className="text-xs text-mq-text-muted">
                A link to set a new password will be sent to your email address.
              </p>
              <button type="submit" className="mq-btn mq-btn-outline w-full">
                Register
              </button>
            </form>
          </div>
        </div>
      </Container>
    </>
  );
}
