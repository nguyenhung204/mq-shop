"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCreateRma, useOrder } from "@/lib/queries/orders";
import { canRequestRma, hasBlockingRma } from "@/lib/api/orders";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Container, PageHero } from "@/components/ui/shared";
import { translateStatus } from "@/lib/i18n/status";
import { getErrorMessage } from "@/lib/queries/utils";

function CreateRmaInner() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { data: order } = useOrder(id);
  const createRma = useCreateRma(id);
  const [reason, setReason] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  const allowed = order ? canRequestRma(order) : false;
  const blockedByExisting = order ? hasBlockingRma(order) : false;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.length < 5 || reason.length > 1000) {
      setError(t("orders.rma.reasonError"));
      return;
    }
    setError("");
    try {
      await createRma.mutateAsync({
        body: {
          reason,
          bankInfo: { bankName, accountNumber, accountName },
        },
        evidence: files.length ? files.slice(0, 5) : undefined,
      });
      router.push(`/orders/${id}`);
    } catch (err) {
      setError(getErrorMessage(err, t("toast.rmaFailed"), locale));
    }
  };

  return (
    <>
      <PageHero
        title={t("orders.rma.title")}
        breadcrumb={[
          { label: t("orders.rma.breadcrumbOrders"), href: "/orders" },
          { label: id.slice(0, 8), href: `/orders/${id}` },
          { label: t("orders.rma.breadcrumbRma") },
        ]}
      />
      <Container className="py-10 max-w-lg mx-auto">
        {!order ? (
          <p className="text-sm text-mq-text-muted">{t("orders.detail.loading")}</p>
        ) : !allowed ? (
          <div className="mq-alert mq-alert-error space-y-2">
            <p>
              {blockedByExisting
                ? order.rma
                  ? t("orders.rma.blockedExistingWithStatus", {
                      status: translateStatus(t, "rmaMessage", order.rma.status),
                    })
                  : t("orders.rma.blockedExisting")
                : t("orders.rma.notEligible")}
            </p>
            <Link href={`/orders/${id}`} className="underline">
              {t("orders.rma.backToOrder")}
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mq-card p-6 space-y-4">
            <p className="text-sm text-mq-text-secondary">{t("orders.rma.formHint")}</p>
            {error ? <div className="mq-alert mq-alert-error">{error}</div> : null}
            <textarea
              className="mq-textarea"
              placeholder={t("orders.rma.reasonPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <input
              className="mq-input"
              placeholder={t("orders.rma.bankName")}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />
            <input
              className="mq-input"
              placeholder={t("orders.rma.accountNumber")}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
            <input
              className="mq-input"
              placeholder={t("orders.rma.accountName")}
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm mb-1.5" htmlFor="evidence">
                {t("orders.rma.evidenceLabel")}
              </label>
              <input
                id="evidence"
                className="mq-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
              />
            </div>
            <button className="mq-btn mq-btn-primary w-full" disabled={createRma.isPending}>
              {createRma.isPending ? t("orders.rma.submitting") : t("orders.rma.submitBtn")}
            </button>
          </form>
        )}
      </Container>
    </>
  );
}

export default function CreateRmaPage() {
  return (
    <AuthGuard>
      <CreateRmaInner />
    </AuthGuard>
  );
}
