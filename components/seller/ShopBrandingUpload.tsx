"use client";

import { ChangeEvent, useRef } from "react";
import { toast } from "sonner";
import { useUploadShopBanner, useUploadShopLogo } from "@/lib/queries/seller";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

function validateFile(file: File): boolean {
  if (!ACCEPT.split(",").includes(file.type)) {
    toast.error("Invalid image type. Use JPEG, PNG, WebP, or GIF.");
    return false;
  }
  if (file.size > MAX_BYTES) {
    toast.error("Image must be ≤ 5MB.");
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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const uploadLogo = useUploadShopLogo();
  const uploadBanner = useUploadShopBanner();

  const onLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !validateFile(file)) return;
    void uploadLogo.mutateAsync(file);
  };

  const onBannerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !validateFile(file)) return;
    void uploadBanner.mutateAsync(file);
  };

  const busy = uploadLogo.isPending || uploadBanner.isPending;

  return (
    <div className="space-y-5">
      <p className="mq-shop-hint">
        JPEG / PNG / WebP / GIF · ≤5MB. Logo ~512×512, banner ~1600×400 (stored as WebP).
      </p>

      <div className="flex flex-wrap gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-mq-text-muted">Logo</p>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Shop logo"
              className="w-28 h-28 rounded-2xl object-cover border border-mq-border bg-mq-surface-subtle"
            />
          ) : (
            <div className="w-28 h-28 rounded-2xl border border-dashed border-mq-border bg-mq-surface-subtle flex items-center justify-center text-[10px] text-mq-text-muted text-center px-1">
              No logo
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
                {uploadLogo.isPending ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
              </button>
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-mq-text-muted">Banner</p>
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt="Shop banner"
              className="h-28 w-full max-w-lg rounded-2xl object-cover border border-mq-border bg-mq-surface-subtle"
            />
          ) : (
            <div className="h-28 w-full max-w-lg rounded-2xl border border-dashed border-mq-border bg-mq-surface-subtle flex items-center justify-center text-[10px] text-mq-text-muted">
              No banner
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
                  ? "Uploading…"
                  : bannerUrl
                    ? "Replace banner"
                    : "Upload banner"}
              </button>
            </>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="mq-shop-hint">
          Logo/banner can be updated when the shop is APPROVED and not suspended.
        </p>
      )}
    </div>
  );
}
