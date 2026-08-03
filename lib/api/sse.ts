import { getApiHost, refreshSessionShared } from "@/lib/api/client";

export type SseHandlers = {
  onOpen?: () => void;
  onMessage: (raw: string) => void;
  onError?: (err: unknown) => void;
  /** Called when the stream closed cleanly and we are about to reconnect. */
  onReconnecting?: () => void;
};

/**
 * Authenticated SSE via fetch + ReadableStream.
 * Auth is handled via httpOnly cookies (credentials: "include").
 */
export function openAuthenticatedSse(
  path: string,
  handlers: SseHandlers,
  signal: AbortSignal,
): Promise<void> {
  return connectLoop(path, handlers, signal);
}

/** Sentinel — server closed the stream normally; we should silently reconnect. */
class SseStreamEndedError extends Error {
  constructor() {
    super("SSE stream ended");
    this.name = "SseStreamEndedError";
  }
}

async function connectLoop(
  path: string,
  handlers: SseHandlers,
  signal: AbortSignal,
): Promise<void> {
  let attempt = 0;

  while (!signal.aborted) {
    try {
      await readOnce(path, handlers, signal);
      attempt = 0;
    } catch (err) {
      if (signal.aborted) return;
      if (err instanceof SseStreamEndedError) {
        // Server closed the keep-alive stream — normal SSE behaviour.
        attempt = 0;
        handlers.onReconnecting?.();
      } else {
        // Genuine network / auth error.
        handlers.onError?.(err);
        attempt += 1;
      }
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
      await sleep(delay, signal);
    }
  }
}

async function readOnce(
  path: string,
  handlers: SseHandlers,
  signal: AbortSignal,
): Promise<void> {
  const url = `${getApiHost()}/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  let res = await fetch(url, {
    method: "GET",
    headers: { Accept: "text/event-stream" },
    credentials: "include",
    signal,
    cache: "no-store",
  });

  if (res.status === 401) {
    const ok = await refreshSessionShared();
    if (!ok) throw new Error("SSE unauthorized");
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      credentials: "include",
      signal,
      cache: "no-store",
    });
  }

  if (!res.ok || !res.body) {
    throw new Error(`SSE HTTP ${res.status}`);
  }

  handlers.onOpen?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = flushSseBuffer(buffer, handlers.onMessage);
  }

  // Server closed the stream — this is normal SSE behaviour (keep-alive timeout,
  // server restart, etc.). Throw a sentinel so connectLoop can reconnect silently
  // without surfacing an error to the UI.
  throw new SseStreamEndedError();
}

/** Parse complete SSE events from buffer; return leftover incomplete chunk. */
function flushSseBuffer(buffer: string, onMessage: (raw: string) => void): string {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith(":") || line.trim() === "") continue; // comment / heartbeat
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, ""));
      }
    }
    if (dataLines.length > 0) onMessage(dataLines.join("\n"));
  }
  return rest;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
