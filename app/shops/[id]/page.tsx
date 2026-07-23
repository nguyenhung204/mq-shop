"use client";

import { Suspense } from "react";
import { ShopStorefrontContent } from "@/components/shop/ShopStorefrontContent";
import { Container } from "@/components/ui/shared";

export default function ShopStorefrontPage() {
  return (
    <Suspense
      fallback={
        <Container className="py-20 text-sm text-mq-text-muted">
          Loading shop…
        </Container>
      }
    >
      <ShopStorefrontContent />
    </Suspense>
  );
}
