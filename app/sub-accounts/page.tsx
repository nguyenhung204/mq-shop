"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { CreateSubAccountForm, InviteTable, NewInviteBox, SubAccountTable } from "@/components/sub-accounts/parts";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Container, PageHero } from "@/components/ui/shared";
import { PaginationBar } from "@/components/ui/PaginationBar";
import type { SubAccountItem } from "@/lib/api/sub-accounts";
import {
  useCreateInvite,
  useCreateSubAccount,
  useRevokeInvite,
  useSubAccountInvites,
  useSubAccounts,
  useWithdrawSubAccount,
} from "@/lib/queries/sub-accounts";
import { getErrorMessage } from "@/lib/queries/utils";
import { atCap, counters } from "@/lib/sub-accounts/model";

function OwnerInner() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);
  const list = useSubAccounts(page);
  const invites = useSubAccountInvites(invitePage);
  const create = useCreateSubAccount();
  const withdraw = useWithdrawSubAccount();
  const createInvite = useCreateInvite();
  const revoke = useRevokeInvite();
  const [confirm, setConfirm] = useState<SubAccountItem | null>(null);
  const [setupMail, setSetupMail] = useState<boolean | null>(null);
  const c = counters(list.data?.meta);
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHero title={t("subAccounts.title")} />
      <Container className="py-8 space-y-6">
        <p className="text-sm text-mq-text-muted">{t("subAccounts.intro")}</p>
        <div className="mq-card p-4 flex flex-wrap gap-6 text-sm">
          <p>
            <span className="text-mq-text-muted">{t("subAccounts.counter")}: </span>
            <strong className="tabular-nums">{t("subAccounts.nOfCap", { n: String(c.used), cap: String(c.cap) })}</strong>
          </p>
          <p>
            <span className="text-mq-text-muted">{t("subAccounts.pending")}: </span>
            <strong className="tabular-nums">{c.pending}</strong>
          </p>
        </div>

        <CreateSubAccountForm
          admin={false}
          busy={create.isPending}
          atCap={atCap(c)}
          onSubmit={async (body) => {
            try {
              const r = await create.mutateAsync(body);
              setSetupMail(r.setupMailSent);
              return true;
            } catch {
              return false;
            }
          }}
        />
        {setupMail === true ? <div className="mq-alert mq-alert-success">{t("subAccounts.create.mailSent")}</div> : null}
        {setupMail === false ? <div className="mq-alert mq-alert-error">{t("subAccounts.create.mailNotSent")}</div> : null}

        {list.isError ? <div className="mq-alert mq-alert-error">{getErrorMessage(list.error, t("admin.common.failed"))}</div> : null}
        {!list.isLoading && !list.isError && items.length === 0 ? <p className="text-sm text-mq-text-muted">{t("subAccounts.empty")}</p> : null}
        {items.length > 0 ? <SubAccountTable items={items} busy={withdraw.isPending} actionLabelKey="subAccounts.withdraw" onAction={setConfirm} /> : null}
        <PaginationBar page={page} meta={list.data?.meta} onPageChange={setPage} />

        <section className="space-y-3">
          <h2 className="font-semibold">{t("subAccounts.invites.title")}</h2>
          <p className="text-sm text-mq-text-muted">{t("subAccounts.invites.explain")}</p>
          <button
            type="button"
            className="mq-btn mq-btn-primary text-xs"
            disabled={createInvite.isPending}
            onClick={() => {
              createInvite.reset();
              createInvite.mutate();
            }}
          >
            {createInvite.isPending ? t("admin.common.working") : t("subAccounts.invites.create")}
          </button>
          <NewInviteBox created={createInvite.data} origin={typeof window === "undefined" ? "" : window.location.origin} onDismiss={() => createInvite.reset()} />
          <InviteTable items={invites.data?.items ?? []} busy={revoke.isPending} onRevoke={(i) => revoke.mutate(i.id)} />
          <PaginationBar page={invitePage} meta={invites.data?.meta} onPageChange={setInvitePage} />
        </section>
      </Container>
      <ConfirmDialog
        open={confirm !== null}
        title={t("subAccounts.withdrawConfirm.title")}
        description={t("subAccounts.withdrawConfirm.desc", { email: confirm?.email ?? "" })}
        confirmLabel={t("subAccounts.withdraw")}
        tone="warn"
        busy={withdraw.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          try {
            await withdraw.mutateAsync(confirm.id);
          } finally {
            setConfirm(null);
          }
        }}
      />
    </>
  );
}

export default function SubAccountsPage() {
  return (
    <AuthGuard roles={["BUYER", "SELLER"]}>
      <OwnerInner />
    </AuthGuard>
  );
}
