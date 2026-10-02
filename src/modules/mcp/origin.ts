/** Public origin of this request, including the host a proxy forwarded. */
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  if (forwarded) return `${proto}://${forwarded}`;
  return url.origin;
}

export const READ_SCOPE = "worklane:read";
export const WRITE_SCOPE = "worklane:write";
export const OFFLINE_SCOPE = "offline_access";
export const ACCESS_TTL_SEC = 60 * 60;
export const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const CODE_TTL_MS = 10 * 60 * 1000;

export function mcpResource(origin: string) {
  return `${origin}/mcp`;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResource(origin),
    authorization_servers: [origin],
    scopes_supported: [READ_SCOPE, WRITE_SCOPE, OFFLINE_SCOPE],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/connect`,
    resource_policy_uri: `${origin}/privacy`,
    resource_tos_uri: `${origin}/terms`,
  };
}

export function originFromHeaders(headers: Headers) {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || headers.get("host")?.split(",")[0]?.trim();
  if (!host) return null;
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
