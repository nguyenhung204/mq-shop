import { apiRegionCode, isValidRegion, regionIdFromApiCode, type BusinessRegionCode, type GateRegionId } from "@/lib/i18n/regions";

/**
 * The region the UI starts with. A signed-in account's region (me.regionCode) is the authority:
 * it wins over what the browser remembers. Without a usable server region (signed out, an older
 * cached profile, a value that is not a business region) the browser's saved choice is used.
 */
export function initialRegion(serverCode: string | null | undefined, saved: string | null): GateRegionId | null {
  const fromServer = regionIdFromApiCode(serverCode);
  if (fromServer) return fromServer;
  return isValidRegion(saved) ? saved : null;
}

export type SwitchResult = { ok: true } | { ok: false; error: unknown };

/**
 * Region switch. Signed in: PATCH /users/me/region FIRST, then commit locally; if the server refuses
 * (REGION_INVALID, offline, 403) the old region stays. Signed out: local only.
 */
export async function switchRegion(args: {
  id: GateRegionId;
  authenticated: boolean;
  persist?: (code: BusinessRegionCode) => Promise<unknown>;
  commit: (id: GateRegionId) => void;
}): Promise<SwitchResult> {
  if (args.authenticated && args.persist) {
    try {
      await args.persist(apiRegionCode(args.id));
    } catch (error) {
      return { ok: false, error };
    }
  }
  args.commit(args.id);
  return { ok: true };
}

/** Region code for the buyer checkout body: the region currently selected, upper case; undefined if none. */
export function checkoutRegionCode(region: GateRegionId | null): BusinessRegionCode | undefined {
  return region ? apiRegionCode(region) : undefined;
}

/**
 * Runs region switches strictly one after the other, in the order they were requested. A slow switch A
 * followed by a fast switch B therefore cannot commit B first and A last: the latest request always
 * ends up as the final state (both for the account on the server and for the UI).
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task, task);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}
