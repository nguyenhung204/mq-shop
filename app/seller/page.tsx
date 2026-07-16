"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { useAuth } from "@/components/providers/AuthProvider";
import { Container, PageHero } from "@/components/ui/shared";

function SellerHome() {
  const { hasRole } = useAuth();
  return (
    <>
      <PageHero title="Seller Center" breadcrumb={[{ label: "Seller" }]} />
      <Container className="py-10">
        <SellerNav />
        {!hasRole("SELLER") ? (
          <div className="mq-card p-6 max-w-lg">
            <p className="text-sm text-mq-text-secondary mb-4">
              You do not have the Seller role yet. Apply to open a shop — after Admin approval, sign in again to refresh your JWT.
            </p>
            <Link href="/seller/shop" className="mq-btn mq-btn-primary">Apply for shop</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ["/seller/products", "Manage products"],
              ["/seller/inventory", "Warehouses & stock"],
              ["/seller/orders", "Sales orders"],
              ["/seller/rma", "Confirm RMA stock"],
              ["/seller/materials", "Marketing materials"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="mq-card p-5 hover:shadow-[var(--mq-shadow)] transition-shadow">
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}

export default function SellerPage() {
  return (
    <AuthGuard>
      <SellerHome />
    </AuthGuard>
  );
}
