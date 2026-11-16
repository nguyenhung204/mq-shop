import { describe, expect, it } from "vitest";
import { backupCreator, canDownloadBackup, isBackupPruned, SYSTEM_BACKUP_ACTOR_ID } from "./view";

describe("backupCreator", () => {
  it("scheduled / all-zero actor means system", () => {
    expect(backupCreator({ scheduled: true, createdBy: SYSTEM_BACKUP_ACTOR_ID })).toEqual({ kind: "system" });
    expect(backupCreator({ createdBy: SYSTEM_BACKUP_ACTOR_ID })).toEqual({ kind: "system" });
    expect(backupCreator({ scheduled: true, createdBy: null })).toEqual({ kind: "system" });
  });
  it("manual rows show a shortened user id; unknown shows nothing", () => {
    expect(backupCreator({ scheduled: false, createdBy: "abcdef12-0000-4000-8000-000000000000" })).toEqual({ kind: "user", id: "abcdef12" });
    expect(backupCreator({})).toBeNull();
  });
});

describe("pruned backups", () => {
  it("prunedAt or a null storage key means the file is gone", () => {
    expect(isBackupPruned({ prunedAt: "2026-11-16T00:00:00Z", storageKey: "k" })).toBe(true);
    expect(isBackupPruned({ prunedAt: null, storageKey: null })).toBe(true);
    expect(isBackupPruned({ prunedAt: null, storageKey: "k" })).toBe(false);
    expect(isBackupPruned({})).toBe(false);
  });
  it("download only for SUCCESS rows that still have a file", () => {
    expect(canDownloadBackup({ status: "SUCCESS", storageKey: "k", prunedAt: null })).toBe(true);
    expect(canDownloadBackup({ status: "SUCCESS", storageKey: null, prunedAt: "2026-11-16T00:00:00Z" })).toBe(false);
    expect(canDownloadBackup({ status: "SUCCESS", prunedAt: "2026-11-16T00:00:00Z" })).toBe(false);
    expect(canDownloadBackup({ status: "FAILED", storageKey: "k" })).toBe(false);
    expect(canDownloadBackup({ status: "RUNNING" })).toBe(false);
  });
});
