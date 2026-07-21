"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  useAdminShop,
  useApproveShop,
  useRejectShop,
  useSuspendShop,
} from "@/lib/queries/admin";
import type { LocalizedText } from "@/lib/api/types";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { AdminActions, AdminIconButton } from "@/components/admin/AdminIconButton";
import { Check, ShieldAlert, X } from "lucide-react";

function reasonText(reason: string | LocalizedText | null | undefined): string {
  if (!reason) return "";
  if (typeof reason === "string") return reason;
  return reason.vi || reason.en || "";
}

function ShopDetailInner({ id }: { id: string }) {
  const [reason, setReason] = useState("Thiếu giấy tờ");
  const { data: shop, isLoading, isError, error } = useAdminShop(id);
  const approveShop = useApproveShop();
  const rejectShop = useRejectShop();
  const suspendShop = useSuspendShop();

  const docUrl = shop?.documentUrl || shop?.legalDocumentUrl;
  const busy = approveShop.isPending || rejectShop.isPending || suspendShop.isPending;

  return (
    <>
      <AdminPageHeader
        title={shop?.name || "Shop detail"}
        description="Review shop documents and take moderation actions."
      />
      <div className="space-y-6 max-w-3xl">
        <Link href="/admin/shops" className="text-sm text-mq-text-muted hover:text-mq-text">
          ← Back to queue
        </Link>

        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed to load shop"}
          </div>
        )}
        {isLoading && <p className="text-sm text-mq-text-muted">Loading…</p>}

        {shop && (
          <div className="mq-card p-6 space-y-4 text-sm">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-mq-text">{shop.name}</h2>
                <p className="text-xs text-mq-text-muted mt-1 font-mono">{shop.id}</p>
              </div>
              <span className="mq-badge mq-badge-cyan h-fit">{shop.status}</span>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-mq-text-muted">Tax ID</dt>
                <dd>{shop.taxId || shop.taxCode || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-mq-text-muted">Country</dt>
                <dd>{shop.countryCode || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-mq-text-muted">Owner</dt>
                <dd className="font-mono text-xs">{shop.ownerId || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-mq-text-muted">Flags</dt>
                <dd>
                  {shop.violationFlag || shop.contactAdminRequired
                    ? "violation / contact admin"
                    : shop.isSuspended
                      ? "suspended"
                      : "none"}
                </dd>
              </div>
              {shop.pickupAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-mq-text-muted">Pickup address</dt>
                  <dd>{shop.pickupAddress}</dd>
                </div>
              )}
              {reasonText(shop.rejectionReason) && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-mq-text-muted">Rejection reason</dt>
                  <dd>{reasonText(shop.rejectionReason)}</dd>
                </div>
              )}
            </dl>

            {docUrl && (
              <div>
                <p className="text-xs text-mq-text-muted mb-2">Legal document</p>
                {/\.(jpg|jpeg|png|webp|gif)$/i.test(docUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={docUrl}
                    alt="Shop document"
                    className="max-h-64 rounded border border-mq-border object-contain bg-mq-surface-subtle"
                  />
                ) : (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline"
                  >
                    Open document
                  </a>
                )}
              </div>
            )}

            {(shop.logoUrl || shop.bannerUrl) && (
              <div className="flex flex-wrap gap-4">
                {shop.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shop.logoUrl}
                    alt="Logo"
                    className="w-16 h-16 rounded object-cover border border-mq-border"
                  />
                )}
                {shop.bannerUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shop.bannerUrl}
                    alt="Banner"
                    className="h-16 max-w-xs rounded object-cover border border-mq-border"
                  />
                )}
              </div>
            )}

            <div className="pt-2 space-y-3 border-t border-mq-border">
              <input
                className="mq-input max-w-md"
                placeholder="Reject / violation reason (1–150)"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 150))}
              />
              <AdminActions>
                <AdminIconButton
                  label="Approve"
                  icon={Check}
                  tone="approve"
                  disabled={busy || shop.status !== "PENDING"}
                  onClick={() => void approveShop.mutateAsync(shop.id)}
                />
                <AdminIconButton
                  label="Reject"
                  icon={X}
                  tone="reject"
                  disabled={busy || shop.status !== "PENDING" || reason.length < 1}
                  onClick={() => void rejectShop.mutateAsync({ id: shop.id, reason })}
                />
                <AdminIconButton
                  label="Violation lock"
                  icon={ShieldAlert}
                  tone="warn"
                  disabled={busy || shop.status !== "APPROVED"}
                  onClick={() => void suspendShop.mutateAsync({ id: shop.id, reason })}
                />
              </AdminActions>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard
      roles={["ADMIN", "SUPER_ADMIN"]}
      permissions={["APPROVE_SELLER", "APPROVE_SHOP", "SUSPEND_SHOP"]}
    >
      <ShopDetailInner id={id} />
    </AuthGuard>
  );
}
