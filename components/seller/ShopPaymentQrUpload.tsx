"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useUploadShopQr } from "@/lib/queries/seller";
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
  qrUrl?: string | null;
  canEdit: boolean;
};

export function ShopPaymentQrUpload({ qrUrl, canEdit }: Props) {
  const { t, locale } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadQr = useUploadShopQr();
  const [error, setError] = useState("");

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
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
      await uploadQr.mutateAsync(file);
    } catch (err) {
      setError(getErrorMessage(err, t("toast.shopQrUploadFailed"), locale));
    }
  };

  return (
    <div className="space-y-2">
      <FormAlerts error={error} />
      <p className="text-xs font-semibold uppercase tracking-wide text-mq-text-muted">
        {t("seller.shop.paymentQr")}
      </p>
      <p className="mq-shop-hint">{t("seller.shop.qrHint")}</p>
      {qrUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrUrl}
          alt={t("seller.shop.paymentQr")}
          className="h-40 w-40 rounded-2xl object-contain border border-mq-border bg-white"
        />
      ) : (
        <div className="h-40 w-40 rounded-2xl border border-dashed border-mq-border bg-mq-surface-subtle flex items-center justify-center text-[10px] text-mq-text-muted text-center px-2">
          {t("seller.shop.noQr")}
        </div>
      )}
      {canEdit ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => void onChange(e)}
          />
          <button
            type="button"
            className="mq-btn mq-btn-outline text-xs"
            disabled={uploadQr.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {uploadQr.isPending
              ? t("admin.marketing.uploading")
              : qrUrl
                ? t("seller.shop.replaceQr")
                : t("seller.shop.uploadQr")}
          </button>
        </>
      ) : null}
    </div>
  );
}
