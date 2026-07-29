import type { ApiErrorBody, PageMeta } from "./types";

const TOKEN_KEY = "mq_access_token";
const REFRESH_KEY = "mq_refresh_token";

export function getApiHost(): string {
  return (process.env.NEXT_PUBLIC_API_HOST || "http://localhost:3000").replace(/\/$/, "");
}

export function getApiBase(): string {
  return `${getApiHost()}/api/v1`;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
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
  auth?: boolean;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip refresh retry (used by refresh itself) */
  _retried?: boolean;
  /** Return full envelope { data, meta } instead of unwrapped data */
  withMeta?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  try {
    // Docs: cookie-based POST /auth/refresh
    const cookieRes = await fetch(`${getApiBase()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (cookieRes.ok) {
      const json = (await cookieRes.json()) as {
        data?: { accessToken?: string; refreshToken?: string; user?: unknown };
        accessToken?: string;
        refreshToken?: string;
      };
      const access = json.data?.accessToken || json.accessToken;
      const refresh = json.data?.refreshToken || json.refreshToken;
      if (access) setTokens(access, refresh);
      return true;
    }
  } catch {
    /* fall through to body refresh */
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return false;
  }

  try {
    const res = await fetch(`${getApiBase()}/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const json = (await res.json()) as {
      data?: { accessToken: string; refreshToken: string };
      accessToken?: string;
      refreshToken?: string;
    };
    const access = json.data?.accessToken || json.accessToken;
    const refresh = json.data?.refreshToken || json.refreshToken;
    if (!access) {
      clearTokens();
      return false;
    }
    setTokens(access, refresh);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

/** Used by authenticated SSE (EventSource cannot send Bearer). */
export function refreshAccessTokenForSse(): Promise<boolean> {
  return refreshAccessToken();
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
    auth = true,
    headers = {},
    query,
    _retried,
    withMeta,
  } = options;
  const reqHeaders: Record<string, string> = { ...headers };

  if (body !== undefined && !formData) {
    reqHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getAccessToken();
    if (token) reqHeaders.Authorization = `Bearer ${token}`;
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

  if (res.status === 401 && auth && !_retried) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
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
    throw new ApiError(401, "Unauthorized");
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
  const { auth = true, headers = {}, query, _retried } = options;
  const reqHeaders: Record<string, string> = { ...headers };

  if (auth) {
    const token = getAccessToken();
    if (token) reqHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, query), {
    method: "GET",
    headers: reqHeaders,
    credentials: "include",
  });

  if (res.status === 401 && auth && !_retried) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
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
    throw new ApiError(401, "Unauthorized");
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
