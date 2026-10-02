"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/shared/db/require-user";
import { originFromHeaders, mcpResource } from "@/modules/mcp/origin";
import {
  clientAllowsRedirect,
  issueAuthorizationCode,
  normalizeScope,
  resolveOauthClient,
  revokeGrant,
} from "@/modules/mcp/oauth";

const FIELDS = [
  "client_id",
  "redirect_uri",
  "state",
  "code_challenge",
  "code_challenge_method",
  "scope",
  "response_type",
  "resource",
] as const;

function connectBack(formData: FormData) {
  const params = new URLSearchParams();
  for (const key of FIELDS) {
    const value = String(formData.get(key) ?? "");
    if (value) params.set(key, value);
  }
  return `/connect?${params.toString()}`;
}

async function issuer() {
  return originFromHeaders(await headers());
}

function withIssuer(url: URL, origin: string | null) {
  if (origin) url.searchParams.set("iss", origin);
  return url;
}

export async function approveMcpAccessAction(formData: FormData) {
  const { user } = await requireUser();
  const origin = await issuer();
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const method = String(formData.get("code_challenge_method") ?? "");
  const scope = normalizeScope(String(formData.get("scope") ?? ""));
  const resource = String(formData.get("resource") ?? "");
  const client = await resolveOauthClient(clientId);
  const resourceOk = !resource || (origin != null && resource === mcpResource(origin));

  if (
    !client ||
    !scope ||
    !resourceOk ||
    method !== "S256" ||
    !codeChallenge ||
    !clientAllowsRedirect(client, redirectUri)
  ) {
    redirect(`${connectBack(formData)}&error=invalid_request`);
  }

  const code = await issueAuthorizationCode({
    client,
    userId: user.id,
    redirectUri,
    codeChallenge,
    scope,
  });
  const back = withIssuer(new URL(redirectUri), origin);
  back.searchParams.set("code", code);
  if (state) back.searchParams.set("state", state);
  redirect(back.toString());
}

export async function denyMcpAccessAction(formData: FormData) {
  const origin = await issuer();
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const client = await resolveOauthClient(String(formData.get("client_id") ?? ""));
  if (!client || !clientAllowsRedirect(client, redirectUri)) {
    redirect("/connect?error=access_denied");
  }
  const back = withIssuer(new URL(redirectUri), origin);
  back.searchParams.set("error", "access_denied");
  if (state) back.searchParams.set("state", state);
  redirect(back.toString());
}

export async function revokeAssistantAction(grantId: string) {
  const { user } = await requireUser();
  await revokeGrant(user.id, grantId);
  revalidatePath("/", "layout");
}
