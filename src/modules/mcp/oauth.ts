import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import { pkceChallenge, randomToken, sha256, signJwt, verifyJwt } from "@/modules/mcp/crypto";
import {
  ACCESS_TTL_SEC,
  CODE_TTL_MS,
  OFFLINE_SCOPE,
  READ_SCOPE,
  REFRESH_TTL_MS,
} from "@/modules/mcp/origin";

export type OauthClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
};

function admin() {
  const client = createAdminSupabaseClient();
  if (!client) throw new Error("Worklane isn't configured to connect assistants yet.");
  return client;
}

function tokenSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Worklane isn't configured to connect assistants yet.");
  return secret;
}

/** Loopback and the known assistant redirects. Anything else is rejected. */
export function isAllowedRedirect(uri: string) {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === "https:" && url.hostname === "chatgpt.com") {
    if (url.pathname === "/connector_platform_oauth_redirect") return true;
    if (url.pathname.startsWith("/connector/oauth/")) return true;
  }
  if (url.protocol === "https:" && (url.hostname === "claude.ai" || url.hostname.endsWith(".claude.ai"))) {
    return true;
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  return url.protocol === "http:" && loopback;
}

function redirectsMatch(registered: string, requested: string) {
  if (registered === requested) return true;
  let left: URL;
  let right: URL;
  try {
    left = new URL(registered);
    right = new URL(requested);
  } catch {
    return false;
  }
  const loopback = right.hostname === "localhost" || right.hostname === "127.0.0.1" || right.hostname === "[::1]";
  if (!loopback) return false;
  return (
    left.protocol === right.protocol &&
    left.hostname === right.hostname &&
    left.pathname === right.pathname &&
    left.search === right.search
  );
}

export function clientAllowsRedirect(client: OauthClient, redirectUri: string) {
  return isAllowedRedirect(redirectUri) && client.redirectUris.some((uri) => redirectsMatch(uri, redirectUri));
}

export async function registerOauthClient(input: {
  clientName: string;
  redirectUris: string[];
}): Promise<OauthClient> {
  const name = input.clientName.trim().slice(0, 80);
  const uris = [...new Set(input.redirectUris.map((uri) => uri.trim()))].slice(0, 8);
  if (!name) throw new Error("client_name is required");
  if (uris.length === 0 || uris.some((uri) => !isAllowedRedirect(uri))) {
    throw new Error("redirect_uris must be ChatGPT, Claude, or a loopback address");
  }
  const clientId = `wl_${randomToken(18)}`;
  const { error } = await admin().from("oauth_clients").insert({
    client_id: clientId,
    client_name: name,
    redirect_uris: uris,
  });
  if (error) throw new Error(error.message);
  return { clientId, clientName: name, redirectUris: uris };
}

function cimdDocumentUrl(clientId: string) {
  try {
    const url = new URL(clientId);
    if (url.protocol !== "https:" || url.hostname !== "chatgpt.com") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (!url.pathname.startsWith("/oauth/") || !url.pathname.endsWith("/client.json")) return null;
    return url;
  } catch {
    return null;
  }
}

async function loadCimdClient(documentUrl: URL): Promise<OauthClient | null> {
  const response = await fetch(documentUrl, { redirect: "error", cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json().catch(() => null)) as {
    client_name?: string;
    redirect_uris?: unknown;
  } | null;
  const redirectUris = Array.isArray(body?.redirect_uris)
    ? body.redirect_uris.filter((uri): uri is string => typeof uri === "string" && isAllowedRedirect(uri))
    : [];
  if (redirectUris.length === 0) return null;
  const client: OauthClient = {
    clientId: documentUrl.toString(),
    clientName: body?.client_name?.trim().slice(0, 80) || "ChatGPT",
    redirectUris,
  };
  const { error } = await admin().from("oauth_clients").upsert(
    {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
    },
    { onConflict: "client_id" },
  );
  if (error) throw new Error(error.message);
  return client;
}

/** A registered assistant, or ChatGPT identified by its client metadata document. */
export async function resolveOauthClient(clientId: string): Promise<OauthClient | null> {
  const documentUrl = cimdDocumentUrl(clientId);
  if (documentUrl) return loadCimdClient(documentUrl);
  return getOauthClient(clientId);
}

export async function getOauthClient(clientId: string): Promise<OauthClient | null> {
  const { data, error } = await admin()
    .from("oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    clientId: data.client_id as string,
    clientName: data.client_name as string,
    redirectUris: (data.redirect_uris as string[]) ?? [],
  };
}

export function normalizeScope(raw: string | null | undefined) {
  const trimmed = raw?.trim();
  const parts = new Set((trimmed ? trimmed : `${READ_SCOPE} ${OFFLINE_SCOPE}`).split(/\s+/).filter(Boolean));
  if (!parts.has(READ_SCOPE)) return null;
  return [READ_SCOPE, ...(parts.has(OFFLINE_SCOPE) ? [OFFLINE_SCOPE] : [])].join(" ");
}

export async function issueAuthorizationCode(input: {
  client: OauthClient;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
}) {
  const code = randomToken(32);
  const { error } = await admin().from("oauth_codes").insert({
    code_hash: sha256(code),
    client_id: input.client.clientId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    scope: input.scope,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

async function issueTokens(input: {
  userId: string;
  client: OauthClient;
  scope: string;
  audience?: string;
  grantId?: string;
}) {
  const db = admin();
  let grantId = input.grantId;
  let refreshToken: string | undefined;
  if (!grantId) {
    refreshToken = randomToken(32);
    grantId = crypto.randomUUID();
    const { error } = await db.from("oauth_grants").insert({
      id: grantId,
      user_id: input.userId,
      client_id: input.client.clientId,
      client_name: input.client.clientName,
      refresh_hash: sha256(refreshToken),
      last_used_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  } else {
    await db
      .from("oauth_grants")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", grantId)
      .is("revoked_at", null);
  }

  const accessToken = signJwt(
    {
      sub: input.userId,
      grant: grantId,
      client_id: input.client.clientId,
      scope: input.scope,
      ...(input.audience ? { aud: input.audience } : {}),
    },
    tokenSecret(),
    ACCESS_TTL_SEC,
  );

  return {
    access_token: accessToken,
    token_type: "Bearer" as const,
    expires_in: ACCESS_TTL_SEC,
    refresh_token: refreshToken,
    scope: input.scope,
  };
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  audience?: string;
}) {
  const db = admin();
  const { data, error } = await db
    .from("oauth_codes")
    .select("client_id, user_id, redirect_uri, code_challenge, scope, expires_at, consumed_at")
    .eq("code_hash", sha256(input.code))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.consumed_at) return { error: "invalid_grant" as const };
  if (new Date(data.expires_at as string).getTime() < Date.now()) return { error: "invalid_grant" as const };
  if (data.client_id !== input.clientId || data.redirect_uri !== input.redirectUri) {
    return { error: "invalid_grant" as const };
  }
  if (pkceChallenge(input.codeVerifier) !== data.code_challenge) return { error: "invalid_grant" as const };

  const { error: consumeError } = await db
    .from("oauth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("code_hash", sha256(input.code))
    .is("consumed_at", null);
  if (consumeError) throw new Error(consumeError.message);

  const client = await resolveOauthClient(input.clientId);
  if (!client) return { error: "invalid_client" as const };
  const tokens = await issueTokens({
    userId: data.user_id as string,
    client,
    scope: data.scope as string,
    audience: input.audience,
  });
  return { tokens };
}

export async function exchangeRefreshToken(input: {
  refreshToken: string;
  clientId: string;
  audience?: string;
}) {
  const db = admin();
  const { data, error } = await db
    .from("oauth_grants")
    .select("id, user_id, client_id, revoked_at, created_at")
    .eq("refresh_hash", sha256(input.refreshToken))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at || data.client_id !== input.clientId) return { error: "invalid_grant" as const };
  if (Date.now() - new Date(data.created_at as string).getTime() > REFRESH_TTL_MS) {
    return { error: "invalid_grant" as const };
  }
  const client = await resolveOauthClient(input.clientId);
  if (!client) return { error: "invalid_client" as const };
  const tokens = await issueTokens({
    userId: data.user_id as string,
    client,
    scope: `${READ_SCOPE} ${OFFLINE_SCOPE}`,
    audience: input.audience,
    grantId: data.id as string,
  });
  return { tokens };
}

export type AccessGrant = { userId: string; grantId: string; clientId: string };

export async function resolveAccessToken(token: string): Promise<AccessGrant | null> {
  const payload = verifyJwt(token, tokenSecret());
  if (!payload) return null;
  if (typeof payload.sub !== "string" || typeof payload.grant !== "string") return null;
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  if (!scope.split(/\s+/).includes(READ_SCOPE)) return null;
  const { data, error } = await admin()
    .from("oauth_grants")
    .select("id, user_id, revoked_at, created_at")
    .eq("id", payload.grant)
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  if (data.user_id !== payload.sub) return null;
  if (Date.now() - new Date(data.created_at as string).getTime() > REFRESH_TTL_MS) return null;
  await admin()
    .from("oauth_grants")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", payload.grant);
  return { userId: payload.sub, grantId: payload.grant, clientId: String(payload.client_id ?? "") };
}

export async function listGrantsForUser(userId: string) {
  const { data, error } = await admin()
    .from("oauth_grants")
    .select("id, client_name, created_at, last_used_at, revoked_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    clientName: row.client_name as string,
    createdAt: row.created_at as string,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
  }));
}

export async function revokeGrant(userId: string, grantId: string) {
  const { error } = await admin()
    .from("oauth_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId)
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
}
