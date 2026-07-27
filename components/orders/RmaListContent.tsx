"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

function RmaInner() {
  return (
    <>
      <PageHero title="My returns (RMA)" breadcrumb={[{ label: "RMA" }]} />
      <Container className="py-10 md:py-14 space-y-4 max-w-lg mx-auto text-center">
        <p className="text-mq-text-secondary text-sm">
          Create an RMA from a delivered order (within 7 days). Track status on the order detail
          page after admin review.
        </p>
        <Link href="/orders?status=DELIVERED" className="mq-btn mq-btn-primary">
          View delivered orders
        </Link>
      </Container>
    </>
  );
}

export function RmaListContent() {
  return (
    <AuthGuard>
      <RmaInner />
    </AuthGuard>
  );
}
