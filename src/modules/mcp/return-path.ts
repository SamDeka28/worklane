const CONNECT_PATHS = new Set(["/connect", "/oauth/authorize"]);

/** Only the public connect page may be used as a post-login return path. */
export function oauthAuthorizePath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  try {
    const url = new URL(raw, "http://worklane.local");
    if (url.origin !== "http://worklane.local" || !CONNECT_PATHS.has(url.pathname)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
