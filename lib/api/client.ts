import type { ApiErrorBody, PageMeta } from "./types";

export function getApiHost(): string {
  const host = process.env.NEXT_PUBLIC_API_HOST?.replace(/\/$/, "");
  if (host) return host;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_HOST is required in production");
  }
  return "http://localhost:3000";
}

export function getApiBase(): string {
  return `${getApiHost()}/api/v1`;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;
  code: string | null;

  constructor(status: number, message: string, body: ApiErrorBody | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.code = extractApiErrorCode(body, message);
  }
}

function looksLikeApiErrorCode(text: string): boolean {
  return /^[A-Z][A-Z0-9_]{2,}$/.test(text.trim());
}

function extractApiErrorCode(body: ApiErrorBody | null, message: string): string | null {
  if (body?.data?.code) return body.data.code;
  if (typeof body?.error === "string" && looksLikeApiErrorCode(body.error)) return body.error;
  const trimmed = message.trim();
  if (looksLikeApiErrorCode(trimmed)) return trimmed;
  return null;
}

function messageFromBody(body: ApiErrorBody | null, fallback: string): string {
  if (!body) return fallback;
  if (Array.isArray(body.message)) return body.message.join(", ");
  if (typeof body.message === "string") return body.message;
  return fallback;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip refresh retry (used by refresh itself) */
  _retried?: boolean;
  /** Return full envelope { data, meta } instead of unwrapped data */
  withMeta?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the session via httpOnly cookie.
 * BE reads refresh_token from the cookie automatically.
 */
async function refreshSession(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Shared refresh promise so concurrent 401s from SSE + REST
 * do not trigger multiple refresh calls.
 */
export function refreshSessionShared(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(
    path.startsWith("http") ? path : `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`,
  );
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

function isEnvelope(json: unknown): json is {
  statusCode: number;
  data: unknown;
  meta?: PageMeta;
  message?: string;
} {
  return (
    !!json &&
    typeof json === "object" &&
    "statusCode" in json &&
    "data" in json
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    formData,
    headers = {},
    query,
    _retried,
    withMeta,
  } = options;
  const reqHeaders: Record<string, string> = { ...headers };

  if (body !== undefined && !formData) {
    reqHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers: reqHeaders,
    credentials: "include",
    body: formData
      ? formData
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });

  if (res.status === 401 && !_retried) {
    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => {
        refreshPromise = null;
      });
    }
    const ok = await refreshPromise;
    if (ok) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mq:auth-logout"));
    }
    throw new ApiError(401, "UNAUTHORIZED");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }

  if (!res.ok) {
    const errBody = json as ApiErrorBody | null;
    throw new ApiError(res.status, messageFromBody(errBody, res.statusText), errBody);
  }

  if (withMeta && isEnvelope(json)) {
    return { data: json.data, meta: json.meta } as T;
  }

  if (isEnvelope(json)) {
    return json.data as T;
  }

  return json as T;
}

/** Binary GET (ZIP downloads). Parses JSON error envelopes when the response is not ok. */
export async function apiGetBlob(
  path: string,
  options: Omit<RequestOptions, "method" | "body" | "formData" | "withMeta"> = {},
): Promise<Blob> {
  const { headers = {}, query, _retried } = options;
  const reqHeaders: Record<string, string> = { ...headers };

  const res = await fetch(buildUrl(path, query), {
    method: "GET",
    headers: reqHeaders,
    credentials: "include",
  });

  if (res.status === 401 && !_retried) {
    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => {
        refreshPromise = null;
      });
    }
    const ok = await refreshPromise;
    if (ok) {
      return apiGetBlob(path, { ...options, _retried: true });
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mq:auth-logout"));
    }
    throw new ApiError(401, "UNAUTHORIZED");
  }

  if (!res.ok) {
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text };
      }
    }
    const errBody = json as ApiErrorBody | null;
    throw new ApiError(res.status, messageFromBody(errBody, res.statusText), errBody);
  }

  return res.blob();
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body" | "formData">) =>
    apiRequest<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body" | "formData">) =>
    apiRequest<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body" | "formData">) =>
    apiRequest<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body" | "formData">) =>
    apiRequest<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "formData">) =>
    apiRequest<T>(path, { ...opts, method: "DELETE" }),
  postForm: <T>(path: string, formData: FormData, opts?: Omit<RequestOptions, "method" | "body" | "formData">) =>
    apiRequest<T>(path, { ...opts, method: "POST", formData }),
  patchForm: <T>(path: string, formData: FormData, opts?: Omit<RequestOptions, "method" | "body" | "formData">) =>
    apiRequest<T>(path, { ...opts, method: "PATCH", formData }),
  getBlob: (
    path: string,
    opts?: Omit<RequestOptions, "method" | "body" | "formData" | "withMeta">,
  ) => apiGetBlob(path, opts),
};
