import type { ApiBackup } from "@/lib/api/compliance";

export const SYSTEM_BACKUP_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/** "system" for scheduled rows (all-zero actor id), otherwise the manual creator (id shortened). */
export function backupCreator(b: Pick<ApiBackup, "scheduled" | "createdBy">): { kind: "system" } | { kind: "user"; id: string } | null {
  if (b.scheduled || b.createdBy === SYSTEM_BACKUP_ACTOR_ID) return { kind: "system" };
  if (b.createdBy) return { kind: "user", id: b.createdBy.slice(0, 8) };
  return null;
}

/** A pruned scheduled backup keeps its history row but its file is gone. */
export function isBackupPruned(b: Pick<ApiBackup, "status" | "prunedAt" | "storageKey">): boolean {
  // QUEUED / RUNNING / FAILED rows also have no storage key; only a SUCCESS row without one lost its file.
  return Boolean(b.prunedAt) || (b.status === "SUCCESS" && b.storageKey === null);
}

export function canDownloadBackup(b: Pick<ApiBackup, "status" | "prunedAt" | "storageKey">): boolean {
  return b.status === "SUCCESS" && !isBackupPruned(b);
}
