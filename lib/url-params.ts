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
