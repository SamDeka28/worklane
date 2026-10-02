import { NextResponse } from "next/server";
import { mcpResource, requestOrigin } from "@/modules/mcp/origin";
import { exchangeAuthorizationCode, exchangeRefreshToken } from "@/modules/mcp/oauth";

function oauthError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const body = await request.formData().catch(() => null);
  if (!body) return oauthError("invalid_request");
  const grantType = String(body.get("grant_type") ?? "");
  const clientId = String(body.get("client_id") ?? "");
  if (!clientId) return oauthError("invalid_client");

  const origin = requestOrigin(request);
  const resource = String(body.get("resource") ?? "");
  if (resource && resource !== mcpResource(origin)) return oauthError("invalid_target");
  const audience = resource || mcpResource(origin);

  if (grantType === "authorization_code") {
    const result = await exchangeAuthorizationCode({
      code: String(body.get("code") ?? ""),
      clientId,
      redirectUri: String(body.get("redirect_uri") ?? ""),
      codeVerifier: String(body.get("code_verifier") ?? ""),
      audience,
    });
    if ("error" in result) return oauthError(result.error ?? "invalid_grant");
    return NextResponse.json(result.tokens);
  }

  if (grantType === "refresh_token") {
    const result = await exchangeRefreshToken({
      refreshToken: String(body.get("refresh_token") ?? ""),
      clientId,
      audience,
    });
    if ("error" in result) return oauthError(result.error ?? "invalid_grant");
    return NextResponse.json(result.tokens);
  }

  return oauthError("unsupported_grant_type");
}
