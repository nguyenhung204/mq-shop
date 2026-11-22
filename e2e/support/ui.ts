import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { Api } from "./api";
import { ok } from "./api";

/** Browser page logged in as the owner of `api` (its cookies are copied), UI language fixed to English. */
export async function uiPageFor(browser: Browser, who: { api: Api }): Promise<{ page: Page; context: BrowserContext }> {
  const storageState = await who.api.ctx.storageState();
  const context = await browser.newContext({ storageState, baseURL: "http://localhost:3000", viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => { try { localStorage.setItem("mq-lang", "en"); } catch { /* ignore */ } });
  return { page: await context.newPage(), context };
}

export async function getRma(api: Api, rmaId: string): Promise<any> {
  const r = await ok<any>(await api.get(`rma/${rmaId}`));
  return r.rma ?? r;
}
