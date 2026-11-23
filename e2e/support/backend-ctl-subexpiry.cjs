// One-shot helper (flow 21): boots the backend DI container (NO http listener, crons stopped) from mq_backend/dist with the e2e env,
// runs ONE sweep of SubAccountClaimExpiryJob (the hourly job that releases sub-accounts unclaimed for 7 days; it has no HTTP route and
// no clock seam) and exits. Prints one JSON line: @@RESULT@@{"ok":true,"out":{"released":N}}.
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
  const job = app.get(req("modules/sub-accounts/sub-account-claim-expiry.job").SubAccountClaimExpiryJob);
  const released = await job.sweep();
  process.stdout.write("\n@@RESULT@@" + JSON.stringify({ ok: true, out: { released } }) + "\n");
  await app.close();
  process.exit(0);
})().catch((e) => { process.stdout.write("\n@@RESULT@@" + JSON.stringify({ ok: false, error: String((e && e.stack) || e) }) + "\n"); process.exit(1); });
