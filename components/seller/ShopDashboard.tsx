"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, ImageIcon, LayoutDashboard, Store } from "lucide-react";
import {
  useApplyShop,
  useSellerShop,
  useUpdateMyShopBankInfo,
} from "@/lib/queries/seller";
import { ShopBrandingUpload } from "@/components/seller/ShopBrandingUpload";
import { ShopPaymentQrUpload } from "@/components/seller/ShopPaymentQrUpload";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateStatus } from "@/lib/i18n/status";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { ShopCardSkeleton } from "@/components/ui/Skeleton";
import { FormAlerts, useFormAlerts } from "@/lib/ui/form-feedback";
import { getErrorMessage } from "@/lib/queries/utils";
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
  const { t, locale } = useLanguage();
  const applyAlerts = useFormAlerts({
    locale,
    t,
    defaultErrorFallback: t("toast.applyFailed"),
  });
  const bankAlerts = useFormAlerts({
    locale,
    t,
    defaultErrorFallback: t("toast.bankInfoSaveFailed"),
  });
  const { data: shop, isLoading, isError, error } = useSellerShop();
  const applyShop = useApplyShop();
  const updateBank = useUpdateMyShopBankInfo();
  const canReapply = shop?.status === "REJECTED" && !shop.isSuspended;
  const showApply = !shop || canReapply;
  const canEditBranding = Boolean(shop && shop.status === "APPROVED" && !shop.isSuspended);
  const canEditBank = Boolean(shop && shop.status === "APPROVED" && !shop.isSuspended);

  const [section, setSection] = useState<ShopSection>(() => {
    if (initialSection) return initialSection;
    return "overview";
  });
  const [form, setForm] = useState({
    name: "",
    taxId: "",
    countryCode: "VN",
    bankName: "",
    accountNumber: "",
    accountName: "",
  });
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountNumber: "",
    accountName: "",
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

  useEffect(() => {
    if (!shop?.bankInfo) return;
    setBankForm({
      bankName: shop.bankInfo.bankName || "",
      accountNumber: shop.bankInfo.accountNumber || "",
      accountName: shop.bankInfo.accountName || "",
    });
  }, [shop?.bankInfo]);

  const navItems = useMemo(() => {
    const items: { id: ShopSection; label: string; icon: typeof Store }[] = [
      { id: "overview", label: t("seller.shop.overview"), icon: LayoutDashboard },
      { id: "details", label: t("seller.shop.details"), icon: FileText },
      { id: "branding", label: t("seller.shop.branding"), icon: ImageIcon },
    ];
    if (showApply) {
      items.push({
        id: "apply",
        label: t("seller.overview.applyShop"),
        icon: Store,
      });
    }
    return items;
  }, [showApply, t]);

  const reason = reasonText(shop?.rejectionReason);
  const docUrl = shop?.documentUrl || shop?.legalDocumentUrl;

  const apply = async (e: FormEvent) => {
    e.preventDefault();
    if (!documentFile) {
      applyAlerts.setLocalError("seller.shop.documentRequired");
      return;
    }
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountName.trim()) {
      applyAlerts.setLocalError("seller.shop.bankRequired");
      return;
    }
    applyAlerts.clearAlerts();
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("taxId", form.taxId);
      fd.append("countryCode", form.countryCode);
      fd.append("bankName", form.bankName.trim());
      fd.append("accountNumber", form.accountNumber.trim());
      fd.append("accountName", form.accountName.trim());
      fd.append("document", documentFile);
      await applyShop.mutateAsync(fd);
      setSection("overview");
    } catch (err) {
      applyAlerts.setErrorFromApi(err);
    }
  };

  const saveBank = async (e: FormEvent) => {
    e.preventDefault();
    bankAlerts.clearAlerts();
    try {
      await updateBank.mutateAsync({
        bankName: bankForm.bankName.trim(),
        accountNumber: bankForm.accountNumber.trim(),
        accountName: bankForm.accountName.trim(),
      });
    } catch (err) {
      bankAlerts.setErrorFromApi(err);
    }
  };

  if (isLoading) return <ShopCardSkeleton />;

  return (
    <div className="space-y-4">
      {isError && shop !== null ? (
        <div className="mq-alert mq-alert-error">
          {getErrorMessage(error, t("admin.common.failed"))}
        </div>
      ) : null}

      <nav
        className="mq-shop-nav flex flex-row gap-1.5 overflow-x-auto"
        aria-label={t("seller.shop.sectionsAria")}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const disabled = !shop && item.id !== "apply";
          return (
            <button
              key={item.id}
              type="button"
              className={`mq-shop-nav-item${section === item.id ? " is-active" : ""}`}
              disabled={disabled}
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
            <h2>{t("seller.shop.overview")}</h2>
            <p>{t("seller.titles.shopDesc")}</p>
          </header>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mq-badge mq-badge-cyan">{translateStatus(t, "shop", shop.status)}</span>
              {shop.isSuspended ? (
                <span className="mq-badge mq-badge-pink">{t("seller.shop.suspended")}</span>
              ) : null}
            </div>
            {(shop.violationFlag || shop.contactAdminRequired || shop.isSuspended) && (
              <div className="mq-alert mq-alert-error text-sm">
                {t("seller.shop.lockedBanner")}
              </div>
            )}
            <p className="text-mq-text-secondary">
              <strong className="text-mq-text">{shop.name}</strong>
              <br />
              {t("seller.shop.taxId")}: {shop.taxId || shop.taxCode || "—"} ·{" "}
              {shop.countryCode || "—"}
            </p>
            {reason ? (
              <p className="text-mq-accent-pink">
                {t("admin.common.reasonPrefix")}
                {reason}
              </p>
            ) : null}
            {shop.status === "PENDING" ? (
              <p className="text-mq-text-muted">{t("seller.shop.waitingApproval")}</p>
            ) : null}
            {shop.status === "APPROVED" && !shop.isSuspended ? (
              <p className="text-mq-text-muted">{t("seller.titles.overviewDesc")}</p>
            ) : null}
            {shop.bankInfo ? (
              <p className="text-mq-text-secondary text-xs">
                {t("seller.shop.bankInfo")}: {shop.bankInfo.bankName} · {shop.bankInfo.accountNumber} ·{" "}
                {shop.bankInfo.accountName}
              </p>
            ) : shop.status === "APPROVED" ? (
              <p className="text-mq-accent-orange text-xs">{t("seller.shop.bankInfoMissing")}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                onClick={() => setSection("details")}
              >
                {t("admin.common.viewDetails")}
              </button>
              {canEditBranding ? (
                <button
                  type="button"
                  className="mq-btn mq-btn-outline text-xs"
                  onClick={() => setSection("branding")}
                >
                  {t("seller.common.edit")} {t("seller.shop.branding")}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {section === "details" && shop ? (
        <section className="mq-shop-panel">
          <header className="mq-shop-panel-head">
            <h2>{t("seller.shop.details")}</h2>
            <p>{t("seller.titles.shopDesc")}</p>
          </header>
          <dl className="mq-shop-dl">
            <div>
              <dt>{t("seller.common.status")}</dt>
              <dd>{translateStatus(t, "shop", shop.status)}</dd>
            </div>
            <div>
              <dt>{t("seller.shop.taxId")}</dt>
              <dd>{shop.taxId || shop.taxCode || "—"}</dd>
            </div>
            <div>
              <dt>{t("seller.shop.country")}</dt>
              <dd>{shop.countryCode || "—"}</dd>
            </div>
            <div>
              <dt>{t("admin.shops.owner")}</dt>
              <dd>
                {shop.ownerName || shop.ownerEmail
                  ? (
                      <span>
                        {shop.ownerName ?? "—"}
                        {shop.ownerEmail ? (
                          <span className="text-mq-text-muted ml-1 text-xs">
                            ({shop.ownerEmail})
                          </span>
                        ) : null}
                      </span>
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{t("seller.inventoryPage.flags")}</dt>
              <dd>
                {shop.violationFlag || shop.contactAdminRequired
                  ? t("admin.shops.flagViolation")
                  : shop.isSuspended
                    ? t("seller.shop.suspended")
                    : t("admin.shops.flagNone")}
              </dd>
            </div>
            {shop.pickupAddress ? (
              <div className="mq-shop-dl-span">
                <dt>{t("seller.shop.pickupAddress")}</dt>
                <dd>{shop.pickupAddress}</dd>
              </div>
            ) : null}
            {reason ? (
              <div className="mq-shop-dl-span">
                <dt>{t("seller.shop.rejectionReason")}</dt>
                <dd className="text-mq-accent-pink">{reason}</dd>
              </div>
            ) : null}
            {shop.createdAt ? (
              <div>
                <dt>{t("seller.inventoryPage.created")}</dt>
                <dd>{new Date(shop.createdAt).toLocaleString()}</dd>
              </div>
            ) : null}
            {shop.updatedAt ? (
              <div>
                <dt>{t("admin.common.updated")}</dt>
                <dd>{new Date(shop.updatedAt).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>

          {docUrl ? (
            <div className="mt-6 pt-5 border-t border-mq-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-mq-text-muted mb-2">
                {t("seller.shop.document")}
              </p>
              {/\.(jpg|jpeg|png|webp|gif)$/i.test(docUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={docUrl}
                  alt={t("seller.shop.document")}
                  className="max-h-72 w-full rounded border border-mq-border object-contain bg-mq-surface-subtle"
                />
              ) : (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline"
                >
                  {t("seller.shop.document")}
                </a>
              )}
            </div>
          ) : null}

          {canEditBank ? (
            <div className="mt-6 pt-5 border-t border-mq-border">
              <h3 className="text-sm font-semibold mb-1">{t("seller.shop.bankInfo")}</h3>
              <p className="text-xs text-mq-text-muted mb-4">{t("seller.shop.bankInfoDesc")}</p>
              <FormAlerts error={bankAlerts.error} />
              <form className="mq-shop-form" onSubmit={(e) => void saveBank(e)}>
                <div className="mq-shop-field">
                  <label htmlFor="bank-name">{t("seller.shop.bankName")}</label>
                  <input
                    id="bank-name"
                    className="mq-input"
                    value={bankForm.bankName}
                    onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </div>
                <div className="mq-shop-field">
                  <label htmlFor="bank-account">{t("seller.shop.accountNumber")}</label>
                  <input
                    id="bank-account"
                    className="mq-input"
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                    required
                    minLength={5}
                    maxLength={30}
                  />
                </div>
                <div className="mq-shop-field">
                  <label htmlFor="bank-holder">{t("seller.shop.accountName")}</label>
                  <input
                    id="bank-holder"
                    className="mq-input"
                    value={bankForm.accountName}
                    onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })}
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </div>
                <div className="mq-shop-field">
                  <ShopPaymentQrUpload qrUrl={shop?.bankInfo?.qrUrl} canEdit={canEditBank} />
                </div>
                <button className="mq-btn mq-btn-primary" disabled={updateBank.isPending}>
                  {updateBank.isPending ? t("admin.common.saving") : t("seller.shop.saveBankInfo")}
                </button>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      {section === "branding" && shop ? (
        <section className="mq-shop-panel">
          <header className="mq-shop-panel-head">
            <h2>{t("seller.shop.branding")}</h2>
            <p>{t("seller.shop.mediaGate")}</p>
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
            <h2>{t("seller.overview.applyShop")}</h2>
            <p>{t("seller.titles.shopDesc")}</p>
          </header>
          <form className="mq-shop-form" onSubmit={(e) => void apply(e)}>
            <FormAlerts error={applyAlerts.error} />
            <div className="mq-shop-apply-warn" role="alert">
              <p className="mq-shop-apply-warn-title">{t("seller.shop.applyWarningTitle")}</p>
              <p className="mq-shop-apply-warn-desc">{t("seller.shop.applyTaxIdWarning")}</p>
            </div>
            <div className="mq-shop-field">
              <label htmlFor="shop-name">{t("seller.shop.shopName")}</label>
              <input
                id="shop-name"
                className="mq-input"
                placeholder={t("seller.shop.shopName")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="mq-shop-field">
              <label htmlFor="shop-tax">{t("seller.shop.taxId")}</label>
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
              <p className="mq-shop-hint">{t("seller.shop.applyTaxIdHint")}</p>
            </div>
            <div className="mq-shop-field">
              <label htmlFor="shop-country">{t("seller.shop.country")}</label>
              <CountrySelect
                id="shop-country"
                value={form.countryCode}
                onValueChange={(countryCode) => setForm({ ...form, countryCode })}
                required
              />
            </div>
            <div className="mq-shop-field">
              <label htmlFor="apply-bank-name">{t("seller.shop.bankName")}</label>
              <input
                id="apply-bank-name"
                className="mq-input"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="mq-shop-field">
              <label htmlFor="apply-account-number">{t("seller.shop.accountNumber")}</label>
              <input
                id="apply-account-number"
                className="mq-input"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                required
                minLength={5}
                maxLength={30}
              />
              <p className="mq-shop-hint">{t("seller.shop.bankRequiredHint")}</p>
            </div>
            <div className="mq-shop-field">
              <label htmlFor="apply-account-name">{t("seller.shop.accountName")}</label>
              <input
                id="apply-account-name"
                className="mq-input"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <div className="mq-shop-field">
              <label htmlFor="shop-document">{t("seller.shop.document")}</label>
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
              {applyShop.isPending
                ? t("admin.common.working")
                : t("seller.shop.submitApplication")}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
