"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SellerPage() {
  const { hasRole } = useAuth();

  if (!hasRole("SELLER")) {
    return (
      <div className="mq-seller-panel max-w-lg">
        <p className="text-sm text-mq-text-secondary mb-4">
          You do not have the Seller role yet. Apply to open a shop — after Admin approval, sign in
          again to refresh your JWT.
        </p>
        <Link href="/seller/shop" className="mq-btn mq-btn-primary">
          Apply for shop
        </Link>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {[
        ["/seller/shop", "My shop"],
        ["/seller/products", "Manage products"],
        ["/seller/inventory", "Warehouses & stock"],
        ["/seller/orders", "Sales orders"],
        ["/seller/rma", "Confirm RMA stock"],
        ["/seller/materials", "Marketing materials"],
      ].map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="mq-seller-panel !min-h-0 hover:border-[#e7ba0a] transition-colors"
        >
          <span className="text-sm font-medium">{label}</span>
        </Link>
      ))}
    </div>
  );
}
