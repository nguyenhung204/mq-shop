// Helper process: boots the backend's Nest DI container (NO http listener) from mq_backend/dist with the e2e env and
// exposes the two scheduled jobs that have no HTTP route. One JSON request per stdin line, one JSON reply per stdout line.
//   {"id":1,"cmd":"eligible","orderId":"..."}  -> OrderSalesEligibilityService.markEligibleIfReady (the hourly job's per-order step)
//   {"id":2,"cmd":"retryReversals"}            -> CommissionLedgerService.retryPendingReversals (the '17 * * * *' sweep)
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const BACK = path.resolve(__dirname, "../../../mq_backend");
for (const line of fs.readFileSync(path.resolve(__dirname, "../env/backend.env"), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] = m[2];
}
process.env.DATABASE_URL = process.env.E2E_DB_URL || "postgres://e2e:e2e_pw_local@localhost:55432/mq_e2e";
process.env.TYPEORM_SYNC = "false";
process.env.BACKUP_DAILY_ENABLED = "false";
process.chdir(path.resolve(__dirname, "../.run"));
const req = (p) => require(path.join(BACK, "dist", p));
(async () => {
  const { NestFactory } = require(path.join(BACK, "node_modules/@nestjs/core"));
  const app = await NestFactory.createApplicationContext(req("app.module").AppModule, { logger: false });
  // this is a helper, not a second scheduler: stop every cron the DI container registered
  const reg = app.get(require(path.join(BACK, "node_modules/@nestjs/schedule")).SchedulerRegistry);
  for (const j of reg.getCronJobs().values()) j.stop();
  const elig = app.get(req("modules/orders/shared/order-sales-eligibility.service").OrderSalesEligibilityService);
  const ledger = app.get(req("modules/commission/commission-ledger.service").CommissionLedgerService);
  const ds = app.get(require(path.join(BACK, "node_modules/typeorm")).DataSource);
  process.stdout.write(JSON.stringify({ ready: true }) + "\n");
  const rl = readline.createInterface({ input: process.stdin });
  let chain = Promise.resolve();
  rl.on("line", (line) => {
    chain = chain.then(async () => {
      const r = JSON.parse(line);
      try {
        let out;
        if (r.cmd === "eligible") {
          const marked = await elig.markEligibleIfReady(r.orderId);
          // listeners are fire-and-forget (EventEmitter2 does not await them): wait until the referral row exists
          let row = false;
          for (let i = 0; marked && i < 100 && !row; i++) {
            row = (await ds.query("SELECT 1 FROM commission_ledger WHERE source_order_id=$1 LIMIT 1", [r.orderId])).length > 0;
            if (!row) await new Promise((x) => setTimeout(x, 100));
          }
          out = { marked, ledgerRow: row };
        } else if (r.cmd === "retryReversals") {
          out = await ledger.retryPendingReversals();
        } else throw new Error("unknown cmd " + r.cmd);
        process.stdout.write(JSON.stringify({ id: r.id, ok: true, out }) + "\n");
      } catch (e) {
        process.stdout.write(JSON.stringify({ id: r.id, ok: false, error: String(e && e.stack || e) }) + "\n");
      }
    });
  });
  rl.on("close", async () => { await chain; await app.close(); process.exit(0); });
})().catch((e) => { process.stdout.write(JSON.stringify({ fatal: String(e && e.stack || e) }) + "\n"); process.exit(1); });
