import { execFile } from "node:child_process";
import path from "node:path";

/** Run the AUTO-CANCEL step of the stale-bill job once (no HTTP route; the real job runs daily 09:00 Asia/Taipei). Returns how many orders it cancelled. */
export function runStaleBillAutoCancel(): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile("node", [path.join(__dirname, "backend-ctl-jobs.cjs"), "autoCancel"], { maxBuffer: 1 << 24, timeout: 120_000 }, (err, stdout, stderr) => {
      const m = /@@RESULT@@(.*)/.exec(stdout);
      if (!m) return reject(new Error(`backend-ctl-jobs: no result (${err?.message ?? ""}) ${stderr.slice(-500)} ${stdout.slice(-500)}`));
      const r = JSON.parse(m[1]);
      r.ok ? resolve(r.out.cancelled as number) : reject(new Error(r.error));
    });
  });
}
