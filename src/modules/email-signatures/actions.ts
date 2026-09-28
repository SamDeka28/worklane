"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/modules/identity/org";
import {
  cleanSignatureDoc,
  SIGNATURE_MAX_BYTES,
  type SignatureMode,
  type SignatureModule,
} from "@/modules/email-signatures/types";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";

type Result = { ok: true } | { error: string };

type RowValues = {
  mode?: SignatureMode;
  body?: unknown;
  allow_override?: boolean;
  use_in_leads?: boolean;
  use_in_emails?: boolean;
};

const UNAVAILABLE = "Couldn't save the signature. The email_signatures migration may not be applied yet.";
const TOO_LONG = "That signature is too long. Try fewer or smaller images, or less text.";

function tooLong(doc: unknown) {
  return doc != null && JSON.stringify(doc).length > SIGNATURE_MAX_BYTES;
}

async function upsert(
  orgId: string,
  userId: string | null,
  updatedBy: string,
  row: RowValues,
): Promise<Result> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { error: "The Supabase service key isn't configured" };
  let query = admin.from("email_signatures").select("id").eq("organization_id", orgId);
  query = userId ? query.eq("user_id", userId) : query.is("user_id", null);
  const { data: existing, error: loadError } = await query.maybeSingle();
  if (loadError) return { error: UNAVAILABLE };
  const values = { ...row, updated_by: updatedBy, updated_at: new Date().toISOString() };
  const { error } = existing
    ? await admin.from("email_signatures").update(values).eq("id", existing.id)
    : await admin
        .from("email_signatures")
        .insert({ mode: userId ? "studio" : "custom", ...values, organization_id: orgId, user_id: userId });
  return error ? { error: UNAVAILABLE } : { ok: true };
}

function revalidate(orgSlug: string) {
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/profile`);
  revalidatePath(`/${orgSlug}/crm`);
  revalidatePath(`/${orgSlug}/emails`);
}

async function requireAdmin(orgSlug: string) {
  const ctx = await requireOrg(orgSlug);
  return ctx.role === "owner" || ctx.role === "admin" ? ctx : null;
}

/** Owners and admins: the default signature for everyone in the studio. */
export async function saveStudioSignatureAction(
  orgSlug: string,
  input: { doc: unknown; allowOverride: boolean },
): Promise<Result> {
  const ctx = await requireAdmin(orgSlug);
  if (!ctx) return { error: "Only owners and admins can change the studio signature" };
  if (tooLong(input.doc)) return { error: TOO_LONG };
  const result = await upsert(ctx.org.id, null, ctx.userId, {
    body: cleanSignatureDoc(input.doc),
    allow_override: Boolean(input.allowOverride),
  });
  if ("ok" in result) revalidate(orgSlug);
  return result;
}

/** Owners and admins: whether lead emails or Compose emails get a signature at all. */
export async function setSignatureModuleAction(
  orgSlug: string,
  module: SignatureModule,
  on: boolean,
): Promise<Result> {
  const ctx = await requireAdmin(orgSlug);
  if (!ctx) return { error: "Only owners and admins can change where signatures are added" };
  const column = module === "leads" ? "use_in_leads" : "use_in_emails";
  const result = await upsert(ctx.org.id, null, ctx.userId, { [column]: Boolean(on) });
  if ("ok" in result) revalidate(orgSlug);
  return result;
}

/** A member's own choice: follow the studio's signature, use their own, or none. */
export async function savePersonalSignatureAction(
  orgSlug: string,
  input: { mode: SignatureMode; doc: unknown },
): Promise<Result> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.canWrite) return { error: "You can't send email from this studio" };
  const mode: SignatureMode = ["studio", "custom", "none"].includes(input.mode) ? input.mode : "studio";
  if (tooLong(input.doc)) return { error: TOO_LONG };
  const doc = cleanSignatureDoc(input.doc);
  if (mode === "custom" && !doc) return { error: "Write your signature, or pick another option" };
  const result = await upsert(ctx.org.id, ctx.userId, ctx.userId, {
    mode,
    body: doc,
  });
  if ("ok" in result) revalidate(orgSlug);
  return result;
}

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Stores an image for a signature and returns its public address, so it shows in any inbox. */
export async function uploadSignatureImageAction(
  orgSlug: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const ctx = await requireOrg(orgSlug);
  if (!ctx.canWrite) return { error: "You can't send email from this studio" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image" };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: "Use a PNG, JPEG, GIF, or WebP image" };
  if (file.size > 2 * 1024 * 1024) return { error: "Images in signatures must be under 2 MB" };
  const admin = createAdminSupabaseClient();
  if (!admin) return { error: "The Supabase service key isn't configured" };
  const path = `${ctx.org.id}/${randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from("email-assets")
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: "31536000",
    });
  if (error) {
    return {
      error: /bucket/i.test(error.message)
        ? "Couldn't upload the image. The email_signatures migration may not be applied yet."
        : "Couldn't upload the image. Try again.",
    };
  }
  return { url: admin.storage.from("email-assets").getPublicUrl(path).data.publicUrl };
}
