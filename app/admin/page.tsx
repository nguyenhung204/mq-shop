"use client";

import Link from "next/link";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { useAuth } from "@/components/providers/AuthProvider";
import { Container, PageHero } from "@/components/ui/shared";

function AdminHome() {
  const { user, hasPermission } = useAuth();
  return (
    <>
      <PageHero title="Admin" breadcrumb={[{ label: "Admin" }]} />
      <Container className="py-10">
        <AdminNav />
        <p className="text-sm text-mq-text-secondary mb-6">
          Signed in as {user?.email}. Menus follow your permissions.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ["/admin/shops", "Approve shops", "APPROVE_SHOP"],
            ["/admin/products", "Approve products", "APPROVE_PRODUCT"],
            ["/admin/rma", "Manage RMA", "MANAGE_RMA"],
            ["/admin/finance", "Finance & withdraw", "MANAGE_PAYOUT"],
            ["/admin/banners", "CMS banners", "MANAGE_BANNERS"],
          ]
            .filter(([, , perm]) => hasPermission(perm))
            .map(([href, label]) => (
              <Link key={href} href={href} className="mq-card p-5">
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
        </div>
      </Container>
    </>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]}>
      <AdminHome />
    </AuthGuard>
  );
}
