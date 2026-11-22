// One-shot helper (flow 13): boots the backend DI container (NO http listener, crons stopped) from mq_backend/dist with the e2e env,
// runs ONE step of the stale-bill job and exits. Prints one JSON line: {"ok":true,"out":...} or {"ok":false,"error":...}.
//   node backend-ctl-jobs.cjs autoCancel   -> StaleBillOrdersJob.autoCancel(now)  (ONLY the auto-cancel step: the job's run() also sends
//                                             reminders / sets escalation flags on EVERY pending order of the shared DB, which would
//                                             disturb other specs)
// A short-lived process on purpose: it also starts the BullMQ consumers of the container, so it must not stay up beside a backup test.
const fs = require("node:fs");
const path = require("node:path");
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
  let out;
  if (process.argv[2] === "autoCancel") {
    const job = app.get(req("modules/orders/cancel/stale-bill-orders.job").StaleBillOrdersJob);
    out = { cancelled: await job["autoCancel"](new Date()) }; // private in TS, plain method in dist
  } else throw new Error("unknown cmd " + process.argv[2]);
  process.stdout.write("\n@@RESULT@@" + JSON.stringify({ ok: true, out }) + "\n");
  await app.close();
  process.exit(0);
})().catch((e) => { process.stdout.write("\n@@RESULT@@" + JSON.stringify({ ok: false, error: String((e && e.stack) || e) }) + "\n"); process.exit(1); });
