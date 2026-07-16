"use client";

import { FormEvent, useEffect, useState } from "react";
import { systemApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { asArray } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { Container, PageHero } from "@/components/ui/shared";

function SuperAdminInner() {
  const [logs, setLogs] = useState<unknown[]>([]);
  const [backups, setBackups] = useState<unknown[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [anonId, setAnonId] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", actorEmail: "", actionType: "" });

  const loadLogs = async () => {
    try {
      setLogs(asArray(await systemApi.auditLogs(filters)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    }
  };

  const loadBackups = async () => {
    try {
      setBackups(asArray(await systemApi.backups()));
    } catch {
      /* optional */
    }
  };

  useEffect(() => {
    void loadLogs();
    void loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHero title="System administration" breadcrumb={[{ label: "Super Admin" }]} />
      <Container className="py-10 space-y-8 max-w-4xl">
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {msg && <div className="mq-alert mq-alert-success">{msg}</div>}

        <section className="mq-card p-5 space-y-3">
          <h2 className="text-lg">Audit logs</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <input className="mq-input" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            <input className="mq-input" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            <input className="mq-input" placeholder="Actor email" value={filters.actorEmail} onChange={(e) => setFilters({ ...filters, actorEmail: e.target.value })} />
            <input className="mq-input" placeholder="Action type" value={filters.actionType} onChange={(e) => setFilters({ ...filters, actionType: e.target.value })} />
          </div>
          <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void loadLogs()}>Filter</button>
          <pre className="text-xs overflow-auto max-h-64 bg-mq-surface-subtle p-3 rounded-[var(--mq-radius)]">{JSON.stringify(logs, null, 2)}</pre>
        </section>

        <section className="mq-card p-5 space-y-3">
          <h2 className="text-lg">Backups</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="mq-btn mq-btn-primary text-xs"
              onClick={() =>
                void systemApi
                  .startBackup({ backupType: "FULL" })
                  .then(() => {
                    setMsg("Backup started");
                    return loadBackups();
                  })
                  .catch((e) => setError(e instanceof ApiError ? e.message : "Error"))
              }
            >
              Start FULL
            </button>
            <button
              type="button"
              className="mq-btn mq-btn-outline text-xs"
              onClick={() =>
                void systemApi
                  .startBackup({ backupType: "PARTIAL" })
                  .then(() => {
                    setMsg("Partial backup started");
                    return loadBackups();
                  })
                  .catch((e) => setError(e instanceof ApiError ? e.message : "Error"))
              }
            >
              Start PARTIAL
            </button>
            <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void loadBackups()}>Refresh</button>
          </div>
          <pre className="text-xs overflow-auto max-h-48 bg-mq-surface-subtle p-3 rounded-[var(--mq-radius)]">{JSON.stringify(backups, null, 2)}</pre>
        </section>

        <section className="mq-card p-5 space-y-3">
          <h2 className="text-lg">Anonymization</h2>
          <p className="text-xs text-mq-text-muted">Blocked if open orders/payouts/withdrawals remain.</p>
          <form
            className="space-y-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void systemApi
                .createAnonymization({ targetUserId })
                .then((r) => {
                  const id = (r as { id?: string }).id || "";
                  setAnonId(id);
                  setMsg(`Request created: ${id}`);
                })
                .catch((err) => setError(err instanceof ApiError ? err.message : "Error"));
            }}
          >
            <input className="mq-input" placeholder="Target user ID" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required />
            <button className="mq-btn mq-btn-outline">Create request</button>
          </form>
          <div className="flex gap-2">
            <input className="mq-input" placeholder="Anonymization request ID" value={anonId} onChange={(e) => setAnonId(e.target.value)} />
            <button
              type="button"
              className="mq-btn mq-btn-primary"
              onClick={() =>
                void systemApi
                  .executeAnonymization(anonId)
                  .then(() => setMsg("Executed (or check blockedReason)"))
                  .catch((e) => setError(e instanceof ApiError ? e.message : "Error"))
              }
            >
              Execute
            </button>
          </div>
        </section>
      </Container>
    </>
  );
}

export default function SuperAdminPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN"]}>
      <SuperAdminInner />
    </AuthGuard>
  );
}
