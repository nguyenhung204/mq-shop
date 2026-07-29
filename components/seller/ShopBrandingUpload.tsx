"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useUploadShopBanner, useUploadShopLogo } from "@/lib/queries/seller";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FormAlerts } from "@/lib/ui/form-feedback";
import { getErrorMessage } from "@/lib/queries/utils";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

function validateFile(file: File, t: (key: string) => string): string | null {
  if (!ACCEPT.split(",").includes(file.type)) {
    return t("toast.invalidImageType");
  }
  if (file.size > MAX_BYTES) {
    return t("toast.imageTooLarge");
  }
  return null;
}

type Props = {
  logoUrl?: string | null;
  bannerUrl?: string | null;
  canEdit: boolean;
};

export function ShopBrandingUpload({ logoUrl, bannerUrl, canEdit }: Props) {
  const { t, locale } = useLanguage();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const uploadLogo = useUploadShopLogo();
  const uploadBanner = useUploadShopBanner();
  const [error, setError] = useState("");

  const onLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validationError = validateFile(file, t);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    try {
      await uploadLogo.mutateAsync(file);
    } catch (err) {
      setError(getErrorMessage(err, t("toast.logoUploadFailed"), locale));
    }
  };

  const onBannerChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validationError = validateFile(file, t);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    try {
      await uploadBanner.mutateAsync(file);
    } catch (err) {
      setError(getErrorMessage(err, t("toast.shopBannerUploadFailed"), locale));
    }
  };

  const busy = uploadLogo.isPending || uploadBanner.isPending;

  return (
    <div className="space-y-5">
      <FormAlerts error={error} />
      <p className="mq-shop-hint">{t("seller.shop.mediaHint")}</p>

      <div className="flex flex-wrap gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-mq-text-muted">
            {t("seller.shop.logo")}
          </p>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={t("seller.shop.logo")}
              className="w-28 h-28 rounded-2xl object-cover border border-mq-border bg-mq-surface-subtle"
            />
          ) : (
            <div className="w-28 h-28 rounded-2xl border border-dashed border-mq-border bg-mq-surface-subtle flex items-center justify-center text-[10px] text-mq-text-muted text-center px-1">
              {t("seller.shop.noLogo")}
            </div>
          )}
          {canEdit && (
            <>
              <input
                ref={logoInputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={onLogoChange}
              />
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                disabled={busy}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploadLogo.isPending
                  ? t("admin.marketing.uploading")
                  : logoUrl
                    ? t("seller.shop.replaceLogo")
                    : t("seller.shop.uploadLogo")}
              </button>
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-mq-text-muted">
            {t("seller.shop.banner")}
          </p>
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt={t("seller.shop.banner")}
              className="h-28 w-full max-w-lg rounded-2xl object-cover border border-mq-border bg-mq-surface-subtle"
            />
          ) : (
            <div className="h-28 w-full max-w-lg rounded-2xl border border-dashed border-mq-border bg-mq-surface-subtle flex items-center justify-center text-[10px] text-mq-text-muted">
              {t("seller.shop.noBanner")}
            </div>
          )}
          {canEdit && (
            <>
              <input
                ref={bannerInputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={onBannerChange}
              />
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs"
                disabled={busy}
                onClick={() => bannerInputRef.current?.click()}
              >
                {uploadBanner.isPending
                  ? t("admin.marketing.uploading")
                  : bannerUrl
                    ? t("seller.shop.replaceBanner")
                    : t("seller.shop.uploadBanner")}
              </button>
            </>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="mq-shop-hint">{t("seller.shop.mediaGate")}</p>
      )}
    </div>
  );
}
