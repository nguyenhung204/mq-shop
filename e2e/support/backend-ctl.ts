import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

/** One helper process per Playwright worker (boots the backend DI container once, ~5s). See backend-ctl.cjs. */
let child: ChildProcess | null = null;
let ready: Promise<void> | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

function start(): Promise<void> {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    child = spawn("node", [path.join(__dirname, "backend-ctl.cjs")], { stdio: ["pipe", "pipe", "inherit"] });
    child.unref();
    const proc = child;
    const rl = readline.createInterface({ input: proc.stdout! });
    rl.on("line", (line) => {
      let m: any;
      try { m = JSON.parse(line); } catch { return; }
      if (m.ready) return resolve();
      if (m.fatal) return reject(new Error(m.fatal));
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      m.ok ? p.resolve(m.out) : p.reject(new Error(m.error));
    });
    child.on("exit", () => { child = null; ready = null; for (const p of pending.values()) p.reject(new Error("backend-ctl exited")); pending.clear(); });
    process.on("exit", () => child?.kill());
  });
  return ready;
}

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  await start();
  const id = ++nextId;
  return new Promise<T>((resolve, reject) => { pending.set(id, { resolve, reject }); child!.stdin!.write(JSON.stringify({ id, ...payload }) + "\n"); });
}

/** Run the sales-eligibility step for one order (what the hourly cron does per order). Emits ORDER_SALES_ELIGIBLE -> referral credit. */
export const runEligibility = (orderId: string) => call<{ marked: boolean; ledgerRow: boolean }>({ cmd: "eligible", orderId });
/** Run the hourly clawback retry sweep (cron '17 * * * *') once. */
export const runReversalSweep = () => call<{ retried: number; reversed: number }>({ cmd: "retryReversals" });
