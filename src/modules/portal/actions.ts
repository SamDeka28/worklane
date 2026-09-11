"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrg } from "@/modules/identity/org";
import { generateShareToken, hashShareToken } from "@/modules/portal/token";
import { isShareScope, type ShareExpose, type ShareScope } from "@/modules/portal/types";

export async function createShareGrantAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.portal) return { error: "Portal is disabled for this studio" };

  const kind = String(formData.get("kind") ?? "client");
  const label = String(formData.get("label") ?? "").trim() || null;
  const expiresRaw = String(formData.get("expires_at") ?? "").trim();
  const exposeRaw = formData.getAll("expose").map(String) as ShareExpose[];
  const expose =
    exposeRaw.length > 0 ? exposeRaw : (["invoices", "milestones"] as ShareExpose[]);

  let scope: ShareScope;
  if (kind === "partner") {
    const partnerId = String(formData.get("partner_id") ?? "").trim();
    if (!partnerId) return { error: "Choose a partner" };
    scope = { kind: "partner", partner_id: partnerId, expose };
  } else {
    const clientId = String(formData.get("client_id") ?? "").trim();
    if (!clientId) return { error: "Choose a client" };
    scope = { kind: "client", client_id: clientId, expose };
  }

  if (!isShareScope(scope)) return { error: "Invalid share scope" };

  const rawToken = generateShareToken();
  const tokenHash = hashShareToken(rawToken);

  const { data, error } = await ctx.supabase
    .from("share_grants")
    .insert({
      organization_id: ctx.org.id,
      token_hash: tokenHash,
      label,
      scope,
      expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create share link" };

  revalidatePath(`/${orgSlug}/settings`);
  return { id: data.id as string, token: rawToken };
}

export async function revokeShareGrantAction(orgSlug: string, grantId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  if (!ctx.org.modules.portal) return { error: "Portal is disabled for this studio" };

  const { error } = await ctx.supabase
    .from("share_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", grantId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/settings`);
  return { ok: true as const };
}
