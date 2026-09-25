"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrg, type OrgContext } from "@/modules/identity/org";
import { canAccessProjectTab } from "@/modules/identity/permissions";
import { listCredentialPeople } from "@/modules/credentials/queries";
import {
  isCredentialKind,
  type CredentialEvent,
  type CredentialEventAction,
  type CredentialField,
  type CredentialInput,
  type CredentialSecret,
} from "@/modules/credentials/types";
import { isSecretsConfigured, openSecret, sealSecret } from "@/shared/crypto/secrets";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";

const MAX_VALUE = 10_000;
const MAX_FIELDS = 30;

type Result<T = object> = ({ ok: true } & T) | { error: string };

function secretContext(orgId: string, credentialId: string) {
  return `project_credential:${orgId}:${credentialId}`;
}

function vaultUnavailable(): string | null {
  if (!isSecretsConfigured()) return "Credential vault isn't configured (missing encryption key)";
  if (!createAdminSupabaseClient()) return "Credential vault isn't configured (missing service key)";
  return null;
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function cleanSecret(raw: CredentialSecret | undefined): CredentialSecret | null {
  if (!raw || typeof raw !== "object") return null;
  const fields: CredentialField[] = Array.isArray(raw.fields)
    ? raw.fields
        .slice(0, MAX_FIELDS)
        .map((f) => ({
          label: clean(f?.label, 80).trim(),
          value: clean(f?.value, MAX_VALUE),
          secret: Boolean(f?.secret),
        }))
        .filter((f) => f.label || f.value)
    : [];
  return {
    username: clean(raw.username, 500),
    password: clean(raw.password, MAX_VALUE),
    fields,
    notes: clean(raw.notes, MAX_VALUE),
  };
}

function hasCredentialsTab(ctx: OrgContext) {
  return canAccessProjectTab(ctx.permissions, "credentials");
}

async function logEvent(
  ctx: OrgContext,
  row: { id: string | null; projectId: string; name: string },
  action: CredentialEventAction,
) {
  const admin = createAdminSupabaseClient();
  if (!admin) return;
  const { error } = await admin.from("project_credential_events").insert({
    organization_id: ctx.org.id,
    project_id: row.projectId,
    credential_id: row.id,
    credential_name: row.name,
    actor_id: ctx.userId,
    action,
  });
  if (error) console.error("credential audit log failed:", error.message);
}

/** RLS-scoped lookup: returns null when the user can't see the credential. */
async function loadVisible(ctx: OrgContext, credentialId: string) {
  const { data } = await ctx.supabase
    .from("project_credentials")
    .select("id, project_id, name, restricted, created_by")
    .eq("id", credentialId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    projectId: data.project_id as string,
    name: data.name as string,
    restricted: Boolean(data.restricted),
    createdBy: (data.created_by as string | null) ?? null,
  };
}

function canManage(ctx: OrgContext, createdBy: string | null) {
  return (
    ctx.role === "owner" ||
    ctx.role === "admin" ||
    (ctx.canWrite && createdBy === ctx.userId)
  );
}

async function syncAccess(
  ctx: OrgContext,
  credentialId: string,
  projectId: string,
  orgSlug: string,
  wanted: string[],
): Promise<{ changed: boolean; error?: string }> {
  const { team } = await listCredentialPeople(orgSlug, projectId);
  const eligible = new Set(team.map((p) => p.userId));
  const next = new Set(wanted.filter((id) => eligible.has(id)));

  const { data: current, error } = await ctx.supabase
    .from("project_credential_access")
    .select("user_id")
    .eq("credential_id", credentialId);
  if (error) return { changed: false, error: error.message };
  const have = new Set((current ?? []).map((r) => r.user_id as string));

  const toAdd = [...next].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !next.has(id));

  if (toRemove.length > 0) {
    const { error: delError } = await ctx.supabase
      .from("project_credential_access")
      .delete()
      .eq("credential_id", credentialId)
      .in("user_id", toRemove);
    if (delError) return { changed: false, error: delError.message };
  }
  if (toAdd.length > 0) {
    const { error: insError } = await ctx.supabase.from("project_credential_access").insert(
      toAdd.map((userId) => ({
        credential_id: credentialId,
        organization_id: ctx.org.id,
        user_id: userId,
      })),
    );
    if (insError) return { changed: false, error: insError.message };
  }
  return { changed: toAdd.length > 0 || toRemove.length > 0 };
}

export async function saveCredentialAction(
  orgSlug: string,
  projectId: string,
  input: CredentialInput & { id?: string },
): Promise<Result<{ id: string }>> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.canWrite || !hasCredentialsTab(ctx)) {
    return { error: "You don't have permission to change credentials" };
  }
  const unavailable = vaultUnavailable();
  if (unavailable) return { error: unavailable };

  const name = clean(input.name, 120).trim();
  if (!name) return { error: "Give the credential a name" };
  const kind = isCredentialKind(input.kind) ? input.kind : "other";
  const url = clean(input.url, 500).trim() || null;
  const restricted = Boolean(input.restricted);
  const accessUserIds = Array.isArray(input.accessUserIds)
    ? input.accessUserIds.filter((id): id is string => typeof id === "string")
    : [];
  const secret = cleanSecret(input.secret);
  const admin = createAdminSupabaseClient()!;
  const now = new Date().toISOString();

  if (!input.id) {
    if (!secret) return { error: "Missing credential details" };
    const id = randomUUID();
    const { error } = await ctx.supabase.from("project_credentials").insert({
      id,
      organization_id: ctx.org.id,
      project_id: projectId,
      name,
      kind,
      url,
      restricted,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    });
    if (error) return { error: "You can't add credentials to this project" };

    const sealed = sealSecret(JSON.stringify(secret), secretContext(ctx.org.id, id));
    const { error: secretError } = await admin.from("project_credential_secrets").insert({
      credential_id: id,
      organization_id: ctx.org.id,
      key_version: sealed.keyVersion,
      iv: sealed.iv,
      auth_tag: sealed.authTag,
      ciphertext: sealed.ciphertext,
    });
    if (secretError) {
      await admin.from("project_credentials").delete().eq("id", id);
      return { error: "Couldn't store the credential securely" };
    }

    if (restricted) {
      const access = await syncAccess(ctx, id, projectId, orgSlug, accessUserIds);
      if (access.error) return { error: access.error };
    }
    await logEvent(ctx, { id, projectId, name }, "created");
    revalidatePath(`/${orgSlug}/projects/${projectId}`);
    return { ok: true, id };
  }

  const existing = await loadVisible(ctx, input.id);
  if (!existing || existing.projectId !== projectId) {
    return { error: "Credential not found" };
  }
  const manager = canManage(ctx, existing.createdBy);

  const patch: Record<string, unknown> = {
    name,
    kind,
    url,
    updated_by: ctx.userId,
    updated_at: now,
  };
  if (manager) patch.restricted = restricted;
  if (secret) patch.secret_updated_at = now;

  const { error, count } = await ctx.supabase
    .from("project_credentials")
    .update(patch, { count: "exact" })
    .eq("id", existing.id)
    .eq("organization_id", ctx.org.id);
  if (error || !count) return { error: "You can't edit this credential" };

  if (secret) {
    const sealed = sealSecret(JSON.stringify(secret), secretContext(ctx.org.id, existing.id));
    const { error: secretError } = await admin.from("project_credential_secrets").upsert({
      credential_id: existing.id,
      organization_id: ctx.org.id,
      key_version: sealed.keyVersion,
      iv: sealed.iv,
      auth_tag: sealed.authTag,
      ciphertext: sealed.ciphertext,
      updated_at: now,
    });
    if (secretError) return { error: "Couldn't store the credential securely" };
  }

  let accessChanged = false;
  if (manager) {
    const access = await syncAccess(
      ctx,
      existing.id,
      projectId,
      orgSlug,
      restricted ? accessUserIds : [],
    );
    if (access.error) return { error: access.error };
    accessChanged = access.changed || existing.restricted !== restricted;
  }

  await logEvent(ctx, { id: existing.id, projectId, name }, "updated");
  if (accessChanged) {
    await logEvent(ctx, { id: existing.id, projectId, name }, "access_changed");
  }
  revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return { ok: true, id: existing.id };
}

export async function revealCredentialAction(
  orgSlug: string,
  credentialId: string,
  intent: "reveal" | "copy" = "reveal",
): Promise<Result<{ secret: CredentialSecret }>> {
  const ctx = await requireOrg(orgSlug);
  if (!hasCredentialsTab(ctx)) return { error: "Credential not found" };
  const unavailable = vaultUnavailable();
  if (unavailable) return { error: unavailable };

  const row = await loadVisible(ctx, credentialId);
  if (!row) return { error: "Credential not found" };

  const admin = createAdminSupabaseClient()!;
  const { data, error } = await admin
    .from("project_credential_secrets")
    .select("key_version, iv, auth_tag, ciphertext")
    .eq("credential_id", row.id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (error || !data) return { error: "Credential details are missing" };

  let secret: CredentialSecret;
  try {
    const plaintext = openSecret(
      {
        keyVersion: data.key_version as number,
        iv: data.iv as string,
        authTag: data.auth_tag as string,
        ciphertext: data.ciphertext as string,
      },
      secretContext(ctx.org.id, row.id),
    );
    secret = cleanSecret(JSON.parse(plaintext) as CredentialSecret) ?? {
      username: "",
      password: "",
      fields: [],
      notes: "",
    };
  } catch (err) {
    console.error("credential decrypt failed:", err instanceof Error ? err.message : err);
    return { error: "Couldn't decrypt this credential" };
  }

  await logEvent(ctx, row, intent === "copy" ? "copied" : "revealed");
  return { ok: true, secret };
}

export async function deleteCredentialAction(
  orgSlug: string,
  credentialId: string,
): Promise<Result> {
  const ctx = await requireOrg(orgSlug);
  const row = await loadVisible(ctx, credentialId);
  if (!row) return { error: "Credential not found" };
  if (!canManage(ctx, row.createdBy)) {
    return { error: "Only owners, admins, or whoever added it can delete this" };
  }
  const { error, count } = await ctx.supabase
    .from("project_credentials")
    .delete({ count: "exact" })
    .eq("id", row.id)
    .eq("organization_id", ctx.org.id);
  if (error || !count) return { error: "You can't delete this credential" };

  await logEvent(ctx, { id: null, projectId: row.projectId, name: row.name }, "deleted");
  revalidatePath(`/${orgSlug}/projects/${row.projectId}`);
  return { ok: true };
}

export async function listCredentialEventsAction(
  orgSlug: string,
  credentialId: string,
): Promise<Result<{ events: CredentialEvent[] }>> {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("project_credential_events")
    .select("id, action, actor_id, created_at")
    .eq("organization_id", ctx.org.id)
    .eq("credential_id", credentialId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return { error: error.message };

  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id as string | null).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      const label =
        p.id === ctx.userId
          ? "You"
          : (p.display_name as string | null)?.trim() ||
            (p.email as string | null)?.split("@")[0] ||
            "Someone";
      names.set(p.id as string, label);
    }
  }

  return {
    ok: true,
    events: (data ?? []).map((r) => ({
      id: r.id as number,
      action: r.action as CredentialEventAction,
      actorId: (r.actor_id as string | null) ?? null,
      actorName: names.get(r.actor_id as string) ?? "Former member",
      createdAt: r.created_at as string,
    })),
  };
}
