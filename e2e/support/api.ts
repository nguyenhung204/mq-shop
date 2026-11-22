import { request, type APIRequestContext, type APIResponse } from "@playwright/test";
import path from "node:path";
import { API, AUTH_DIR, ROLES, type RoleName } from "./env";

let ipCounter = 0;
/** Unique client IP per call-site: backend runs with TRUST_PROXY=1, so each gets its own throttle bucket. */
export function freshIp(): string {
  ipCounter += 1;
  const n = (process.pid * 1000 + ipCounter) % 65000;
  return `10.${(n >> 8) & 255}.${n & 255}.${(Date.now() >> 4) % 250}`;
}

/** Context authenticated with the stored session of a seed role (login happened once in global-setup). */
export async function apiAs(role: RoleName): Promise<Api> {
  const ctx = await request.newContext({
    baseURL: API + "/",
    storageState: path.join(AUTH_DIR, `${role}.json`),
    extraHTTPHeaders: { "x-forwarded-for": freshIp() },
  });
  return new Api(ctx);
}

/** Log in an arbitrary account (own throttle bucket). Throws on failure. */
export async function apiLogin(email: string, password: string): Promise<Api> {
  const ctx = await request.newContext({ baseURL: API + "/", extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
  const res = await ctx.post("auth/login", { data: { email, password } });
  if (!res.ok()) throw new Error(`login ${email} -> ${res.status()} ${await res.text()}`);
  return new Api(ctx);
}

export async function anon(): Promise<Api> {
  return new Api(await request.newContext({ baseURL: API + "/", extraHTTPHeaders: { "x-forwarded-for": freshIp() } }));
}

export class Api {
  constructor(public ctx: APIRequestContext) {}
  private opts(data?: unknown, headers?: Record<string, string>) {
    return { data, headers: { "idempotency-key": crypto.randomUUID(), ...headers } };
  }
  get(url: string, headers?: Record<string, string>) { return this.ctx.get(url.replace(/^\//, ""), { headers }); }
  post(url: string, data?: unknown, headers?: Record<string, string>) { return this.ctx.post(url.replace(/^\//, ""), this.opts(data, headers)); }
  put(url: string, data?: unknown, headers?: Record<string, string>) { return this.ctx.put(url.replace(/^\//, ""), this.opts(data, headers)); }
  patch(url: string, data?: unknown, headers?: Record<string, string>) { return this.ctx.patch(url.replace(/^\//, ""), this.opts(data, headers)); }
  delete(url: string, headers?: Record<string, string>) { return this.ctx.delete(url.replace(/^\//, ""), { headers: { "idempotency-key": crypto.randomUUID(), ...headers } }); }
  dispose() { return this.ctx.dispose(); }
}

/** Unwrap the ResponseInterceptor envelope `{data: ...}` and assert the status. */
export async function ok<T = any>(res: APIResponse, expected: number | number[] = [200, 201]): Promise<T> {
  const allowed = Array.isArray(expected) ? expected : [expected];
  const text = await res.text();
  if (!allowed.includes(res.status())) throw new Error(`${res.url()} -> ${res.status()} ${text.slice(0, 400)}`);
  try { const j = JSON.parse(text); return (j && typeof j === "object" && "data" in j ? j.data : j) as T; } catch { return text as unknown as T; }
}

export { ROLES };
