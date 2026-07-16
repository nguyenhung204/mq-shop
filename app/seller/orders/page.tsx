"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sellerApi } from "@/lib/api";
import type { ApiOrder } from "@/lib/api/types";
import { asArray, formatMoney } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { Container, PageHero } from "@/components/ui/shared";

function SellerOrdersInner() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setOrders(asArray(await sellerApi.orders()));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, []);

  return (
    <>
      <PageHero title="Sales orders" breadcrumb={[{ label: "Seller", href: "/seller" }, { label: "Orders" }]} />
      <Container className="py-10 space-y-4">
        <SellerNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {orders.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`} className="mq-card p-4 flex justify-between text-sm">
            <span>#{o.id.slice(0, 8)} · {o.status}</span>
            <span>{formatMoney(o.totalAmountUsd)}</span>
          </Link>
        ))}
      </Container>
    </>
  );
}

export default function SellerOrdersPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <SellerOrdersInner />
    </AuthGuard>
  );
}
