import { execFile } from "node:child_process";
import path from "node:path";

/** Run the 7-day sub-account expiry sweep once (no HTTP route; the real job is hourly). Returns how many reservations it released. */
export function runSubAccountExpirySweep(): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile("node", [path.join(__dirname, "backend-ctl-subexpiry.cjs")], { maxBuffer: 1 << 24, timeout: 120_000 }, (err, stdout, stderr) => {
      const m = /@@RESULT@@(.*)/.exec(stdout);
      if (!m) return reject(new Error(`backend-ctl-subexpiry: no result (${err?.message ?? ""}) ${stderr.slice(-500)} ${stdout.slice(-500)}`));
      const r = JSON.parse(m[1]);
      r.ok ? resolve(r.out.released as number) : reject(new Error(r.error));
    });
  });
}
