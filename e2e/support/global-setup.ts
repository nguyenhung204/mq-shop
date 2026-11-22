import { request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { API, AUTH_DIR, ROLES, type RoleName } from "./env";
import { freshIp } from "./api";

/** One login per role (avoids the 5/min login limit); sessions are reused through storageState. */
export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  for (const role of Object.keys(ROLES) as RoleName[]) {
    const ctx = await request.newContext({ baseURL: API + "/", extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
    const res = await ctx.post("auth/login", { data: ROLES[role] });
    if (!res.ok()) throw new Error(`global-setup login ${role}: ${res.status()} ${await res.text()}`);
    await ctx.storageState({ path: path.join(AUTH_DIR, `${role}.json`) });
    await ctx.dispose();
  }
}
