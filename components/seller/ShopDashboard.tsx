"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, ImageIcon, LayoutDashboard, Store } from "lucide-react";
import { useApplyShop, useSellerShop } from "@/lib/queries/seller";
import { ShopBrandingUpload } from "@/components/seller/ShopBrandingUpload";
import { ShopCardSkeleton } from "@/components/ui/Skeleton";
import "./shop.css";

export type ShopSection = "overview" | "details" | "branding" | "apply";

function reasonText(reason: unknown): string {
  if (!reason) return "";
  if (typeof reason === "string") return reason;
  if (typeof reason === "object" && reason !== null) {
    const r = reason as Record<string, string>;
    return r.vi || r.en || r["zh-TW"] || "";
  }
  return "";
}

type Props = {
  initialSection?: ShopSection;
};

export function ShopDashboard({ initialSection }: Props) {
  const { data: shop, isLoading, isError, error } = useSellerShop();
  const applyShop = useApplyShop();
  const canReapply = shop?.status === "REJECTED" && !shop.isSuspended;
  const showApply = !shop || canReapply;
  const canEditBranding = Boolean(shop && shop.status === "APPROVED" && !shop.isSuspended);

  const [section, setSection] = useState<ShopSection>(() => {
    if (initialSection) return initialSection;
    return "overview";
  });
  const [form, setForm] = useState({
    name: "",
    taxId: "",
    countryCode: "VN",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!shop && section !== "apply") {
      setSection("apply");
      return;
    }
    if (shop && section === "apply" && !canReapply) {
      setSection(initialSection && initialSection !== "apply" ? initialSection : "overview");
    }
  }, [isLoading, shop, canReapply, section, initialSection]);

  const navItems = useMemo(() => {
    const items: { id: ShopSection; label: string; icon: typeof Store }[] = [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "details", label: "Details", icon: FileText },
      { id: "branding", label: "Branding", icon: ImageIcon },
    ];
    if (showApply) {
      items.push({
        id: "apply",
        label: canReapply ? "Resubmit" : "Apply",
        icon: Store,
      });
    }
    return items;
  }, [showApply, canReapply]);

  const reason = reasonText(shop?.rejectionReason);
  const docUrl = shop?.documentUrl || shop?.legalDocumentUrl;

  const apply = async (e: FormEvent) => {
    e.preventDefault();
    if (!documentFile) return;
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("taxId", form.taxId);
    fd.append("countryCode", form.countryCode);
    fd.append("document", documentFile);
    await applyShop.mutateAsync(fd);
    setSection("overview");
  };

  if (isLoading) return <ShopCardSkeleton />;

  return (
    <div className="space-y-4">
      {isError && shop !== null ? (
        <div className="mq-alert mq-alert-error">
          {error instanceof Error ? error.message : "Failed to load shop"}
        </div>
      ) : null}

      <nav
        className="mq-shop-nav flex flex-row gap-1.5 overflow-x-auto"
        aria-label="Shop sections"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          const disabled = !shop && item.id !== "apply";
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              className={`mq-shop-nav-item inline-flex shrink-0 items-center gap-2${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {section === "overview" && shop ? (
        <section className="mq-shop-panel">
          <header className="mq-shop-panel-head">
            <h2>Overview</h2>
            <p>Status and quick summary of your shop.</p>
          </header>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mq-badge mq-badge-cyan">{shop.status}</span>
              {shop.isSuspended ? <span className="mq-badge mq-badge-pink">Suspended</span> : null}
            </div>
            {(shop.violationFlag || shop.contactAdminRequired || shop.isSuspended) && (
              <div className="mq-alert mq-alert-error text-sm">
                Contact admin required — shop may be suspended or flagged.
              </div>
            )}
            <p className="text-mq-text-secondary">
              <strong className="text-mq-text">{shop.name}</strong>
              <br />
              Tax: {shop.taxId || shop.taxCode || "—"} · {shop.countryCode || "—"}
            </p>
            {reason ? <p className="text-mq-accent-pink">Reason: {reason}</p> : null}
            {shop.status === "PENDING" ? (
              <p className="text-mq-text-muted">Waiting for admin approval…</p>
            ) : null}
            {shop.status === "APPROVED" && !shop.isSuspended ? (
              <p className="text-mq-text-muted">
                Shop approved. You can manage products, orders, and branding.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                onClick={() => setSection("details")}
              >
                View details
              </button>
              {canEditBranding ? (
                <button
                  type="button"
                  className="mq-btn mq-btn-outline text-xs"
                  onClick={() => setSection("branding")}
                >
                  Edit branding
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {section === "details" && shop ? (
        <section className="mq-shop-panel">
          <header className="mq-shop-panel-head">
            <h2>Shop details</h2>
            <p>Registration info, document, and timestamps.</p>
          </header>
          <dl className="mq-shop-dl">
            <div>
              <dt>Shop ID</dt>
              <dd className="font-mono text-xs">{shop.id}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{shop.status}</dd>
            </div>
            <div>
              <dt>Tax ID</dt>
              <dd>{shop.taxId || shop.taxCode || "—"}</dd>
            </div>
            <div>
              <dt>Country</dt>
              <dd>{shop.countryCode || "—"}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd className="font-mono text-xs">{shop.ownerId || "—"}</dd>
            </div>
            <div>
              <dt>Flags</dt>
              <dd>
                {shop.violationFlag || shop.contactAdminRequired
                  ? "violation / contact admin"
                  : shop.isSuspended
                    ? "suspended"
                    : "none"}
              </dd>
            </div>
            {shop.pickupAddress ? (
              <div className="mq-shop-dl-span">
                <dt>Pickup address</dt>
                <dd>{shop.pickupAddress}</dd>
              </div>
            ) : null}
            {reason ? (
              <div className="mq-shop-dl-span">
                <dt>Rejection reason</dt>
                <dd className="text-mq-accent-pink">{reason}</dd>
              </div>
            ) : null}
            {shop.createdAt ? (
              <div>
                <dt>Created</dt>
                <dd>{new Date(shop.createdAt).toLocaleString()}</dd>
              </div>
            ) : null}
            {shop.updatedAt ? (
              <div>
                <dt>Updated</dt>
                <dd>{new Date(shop.updatedAt).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>

          {docUrl ? (
            <div className="mt-6 pt-5 border-t border-mq-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-mq-text-muted mb-2">
                Legal document
              </p>
              {/\.(jpg|jpeg|png|webp|gif)$/i.test(docUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={docUrl}
                  alt="Shop document"
                  className="max-h-72 w-full rounded border border-mq-border object-contain bg-mq-surface-subtle"
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
          ) : null}
        </section>
      ) : null}

      {section === "branding" && shop ? (
        <section className="mq-shop-panel">
          <header className="mq-shop-panel-head">
            <h2>Branding</h2>
            <p>
              Upload logo and banner for your storefront. Available when the shop is approved and
              not suspended.
            </p>
          </header>
          <ShopBrandingUpload
            logoUrl={shop.logoUrl}
            bannerUrl={shop.bannerUrl}
            canEdit={canEditBranding}
          />
        </section>
      ) : null}

      {section === "apply" && showApply ? (
        <section className="mq-shop-panel">
          <header className="mq-shop-panel-head">
            <h2>{canReapply ? "Resubmit application" : "Apply to open a shop"}</h2>
            <p>Submit shop name, tax ID, country, and a legal document for admin review.</p>
          </header>
          <form className="mq-shop-form" onSubmit={(e) => void apply(e)}>
            <div className="mq-shop-field">
              <label htmlFor="shop-name">Shop name</label>
              <input
                id="shop-name"
                className="mq-input"
                placeholder="Shop name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="mq-shop-field">
              <label htmlFor="shop-tax">Tax ID</label>
              <input
                id="shop-tax"
                className="mq-input"
                placeholder="1–15 digits"
                value={form.taxId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    taxId: e.target.value.replace(/\D/g, "").slice(0, 15),
                  })
                }
                required
              />
            </div>
            <div className="mq-shop-field">
              <label htmlFor="shop-country">Country code</label>
              <input
                id="shop-country"
                className="mq-input"
                placeholder="VN"
                value={form.countryCode}
                onChange={(e) =>
                  setForm({ ...form, countryCode: e.target.value.toUpperCase() })
                }
                maxLength={2}
                required
              />
            </div>
            <div className="mq-shop-field">
              <label htmlFor="shop-document">Document</label>
              <input
                id="shop-document"
                className="mq-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                required={!canReapply}
              />
              <p className="mq-shop-hint">Document ≤5MB (JPEG/PNG/WebP/PDF)</p>
            </div>
            <button
              className="mq-btn mq-btn-primary"
              disabled={applyShop.isPending || !documentFile}
            >
              {applyShop.isPending ? "Submitting…" : "Submit application"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
