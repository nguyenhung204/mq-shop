"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { X } from "lucide-react";
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
                onChange={(e) => {
                  const next = Array.from(e.target.files ?? []);
                  setFiles((prev) => [...prev, ...next].slice(0, 5));
                  e.target.value = "";
                }}
              />
              {files.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {files.map((file, idx) => (
                    <li
                      key={`${file.name}-${file.size}-${idx}`}
                      className="flex items-center justify-between gap-2 text-xs text-mq-text-secondary"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        className="mq-admin-icon-btn shrink-0"
                        aria-label={t("orders.rma.removeEvidence")}
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
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
