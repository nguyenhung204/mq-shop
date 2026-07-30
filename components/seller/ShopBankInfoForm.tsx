"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Landmark } from "lucide-react";
import { toast } from "sonner";
import { shopApi } from "@/lib/api";
import type { ShopBankInfo } from "@/lib/api/types";
import { sellerKeys } from "@/lib/queries/seller";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FormAlerts, useFormAlerts } from "@/lib/ui/form-feedback";

type Props = {
  bankInfo: ShopBankInfo | null | undefined;
  canEdit: boolean;
};

export function ShopBankInfoForm({ bankInfo, canEdit }: Props) {
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();
  const formAlerts = useFormAlerts({
    locale,
    t,
    defaultErrorFallback: t("admin.common.failed"),
  });

  const [form, setForm] = useState({
    bankName: bankInfo?.bankName ?? "",
    accountNumber: bankInfo?.accountNumber ?? "",
    accountName: bankInfo?.accountName ?? "",
  });

  useEffect(() => {
    if (bankInfo) {
      setForm({
        bankName: bankInfo.bankName,
        accountNumber: bankInfo.accountNumber,
        accountName: bankInfo.accountName,
      });
    }
  }, [bankInfo]);

  const mutation = useMutation({
    mutationFn: () => shopApi.updateBankInfo(form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sellerKeys.shop() });
      toast.success(t("seller.shop.bankInfoSaved"));
      formAlerts.clearAlerts();
    },
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    formAlerts.clearAlerts();
    try {
      await mutation.mutateAsync();
    } catch (err) {
      formAlerts.setErrorFromApi(err);
    }
  };

  const hasBankInfo = Boolean(bankInfo?.bankName);

  return (
    <section className="mq-shop-panel">
      <header className="mq-shop-panel-head">
        <h2 className="flex items-center gap-2">
          <Landmark size={18} strokeWidth={1.75} />
          {t("seller.shop.bankInfo")}
        </h2>
        <p>{t("seller.shop.bankInfoDesc")}</p>
      </header>

      {!hasBankInfo && (
        <div className="mq-alert mq-alert-warning text-sm flex items-start gap-2 mb-4">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{t("seller.shop.bankInfoMissing")}</p>
            <p className="text-mq-text-muted">{t("seller.shop.bankInfoMissingHint")}</p>
          </div>
        </div>
      )}

      <form className="space-y-3 max-w-lg" onSubmit={(e) => void submit(e)}>
        <FormAlerts error={formAlerts.error} />

        <div className="space-y-1">
          <label className="text-xs text-mq-text-muted">{t("seller.shop.bankName")}</label>
          <input
            className="mq-input"
            placeholder={t("seller.shop.bankName")}
            value={form.bankName}
            onChange={(e) => setForm({ ...form, bankName: e.target.value })}
            required
            minLength={2}
            maxLength={100}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-mq-text-muted">{t("seller.shop.accountNumber")}</label>
          <input
            className="mq-input"
            placeholder={t("seller.shop.accountNumber")}
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
            required
            minLength={5}
            maxLength={30}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-mq-text-muted">{t("seller.shop.accountName")}</label>
          <input
            className="mq-input"
            placeholder={t("seller.shop.accountName")}
            value={form.accountName}
            onChange={(e) => setForm({ ...form, accountName: e.target.value })}
            required
            minLength={2}
            maxLength={100}
            disabled={!canEdit}
          />
        </div>

        {canEdit && (
          <button
            type="submit"
            className="mq-btn mq-btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t("seller.common.loading") : t("admin.common.save")}
          </button>
        )}
      </form>
    </section>
  );
}
