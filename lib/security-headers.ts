/**
 * Response headers for every route. Deliberately small: a full CSP could break the app (inline scripts,
 * remote images), so only the two that protect secrets in URLs and clickjacking are set.
 * - Referrer-Policy: no-referrer: a page URL (invite token, reset links) is never sent in a Referer header.
 * - CSP frame-ancestors 'none': the app cannot be framed.
 */
export const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];
