"use client";

import { ChangeEvent, useRef } from "react";
import { toast } from "sonner";
import { useUploadShopBanner, useUploadShopLogo } from "@/lib/queries/seller";
import { useLanguage } from "@/components/providers/LanguageProvider";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

function validateFile(file: File, t: (key: string) => string): boolean {
  if (!ACCEPT.split(",").includes(file.type)) {
    toast.error(t("toast.invalidImageType"));
    return false;
  }
  if (file.size > MAX_BYTES) {
    toast.error(t("toast.imageTooLarge"));
    return false;
  }
  return true;
}

type Props = {
  logoUrl?: string | null;
  bannerUrl?: string | null;
  canEdit: boolean;
};

export function ShopBrandingUpload({ logoUrl, bannerUrl, canEdit }: Props) {
  const { t } = useLanguage();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const uploadLogo = useUploadShopLogo();
  const uploadBanner = useUploadShopBanner();

  const onLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !validateFile(file, t)) return;
    void uploadLogo.mutateAsync(file);
  };

  const onBannerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !validateFile(file, t)) return;
    void uploadBanner.mutateAsync(file);
  };

  const busy = uploadLogo.isPending || uploadBanner.isPending;

  return (
    <div className="space-y-5">
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
