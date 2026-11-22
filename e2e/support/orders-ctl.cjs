// Helper process (own copy, the shared backend-ctl.cjs is untouched): boots the backend DI container from mq_backend/dist
// with the e2e env, crons stopped, and runs ONE order through the hourly "escalate stale payment proof" selection.
//   {"id":1,"cmd":"escalate","orderId":"..."} -> OrderRepository.findStaleProofPendingReview(now - 48h, big limit): if the order is in the
//   result (PENDING, proof uploaded, first proof older than 48 h, not escalated yet) OffPlatformPaymentService.escalateStaleProof(order)
//   is called for THIS order only (the real job would do it for every row). Reply {escalated: boolean}.
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
  const reg = app.get(require(path.join(BACK, "node_modules/@nestjs/schedule")).SchedulerRegistry);
  for (const j of reg.getCronJobs().values()) j.stop();
  const repo = app.get(req("modules/orders/shared/order.repository").OrderRepository);
  const pay = app.get(req("modules/orders/payment/off-platform-payment.service").OffPlatformPaymentService);
  process.stdout.write(JSON.stringify({ ready: true }) + "\n");
  const rl = readline.createInterface({ input: process.stdin });
  let chain = Promise.resolve();
  rl.on("line", (line) => {
    chain = chain.then(async () => {
      const r = JSON.parse(line);
      try {
        if (r.cmd !== "escalate") throw new Error("unknown cmd " + r.cmd);
        const before = new Date(Date.now() - 48 * 3600_000);
        const stale = await repo.findStaleProofPendingReview(before, 1000000);
        const hit = stale.find((o) => o.id === r.orderId);
        if (hit) await pay.escalateStaleProof(hit);
        process.stdout.write(JSON.stringify({ id: r.id, ok: true, out: { escalated: Boolean(hit) } }) + "\n");
      } catch (e) {
        process.stdout.write(JSON.stringify({ id: r.id, ok: false, error: String((e && e.stack) || e) }) + "\n");
      }
    });
  });
  rl.on("close", async () => { await chain; await app.close(); process.exit(0); });
})().catch((e) => { process.stdout.write(JSON.stringify({ fatal: String((e && e.stack) || e) }) + "\n"); process.exit(1); });
