/**
 * `href` without the query parameter `name` (other parameters and the hash stay). Returns the input
 * unchanged when the parameter is not there or the URL cannot be parsed.
 */
export function withoutQueryParam(href: string, name: string): string {
  let url: URL;
  try {
    url = new URL(href, "http://localhost");
  } catch {
    return href;
  }
  if (!url.searchParams.has(name)) return href;
  url.searchParams.delete(name);
  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(href);
  return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Removes `name` from the address bar without adding a history entry (a secret in the URL must not stay in
 * history, a copied link or a screenshot). Does nothing when the parameter is not there.
 */
export function stripParamFromLocation(
  loc: { href: string },
  hist: { state: unknown; replaceState: (state: unknown, unused: string, url?: string) => void },
  name: string,
): boolean {
  const clean = withoutQueryParam(loc.href, name);
  if (clean === loc.href) return false;
  hist.replaceState(hist.state, "", clean);
  return true;
}
