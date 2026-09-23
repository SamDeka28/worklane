"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { requireSupabase } from "@/shared/db/require-user";
import { requireOrg, requireWritableOrg } from "@/modules/identity/org";

export async function signOutAction() {
  const supabase = await requireSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateOrgAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Name is required" };
  }

  const { error } = await ctx.supabase
    .from("organizations")
    .update({ name })
    .eq("id", ctx.org.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

/** Sync display name + Google picture into profiles after OAuth. */
export async function syncProfileFromAuthUser(user: User) {
  const supabase = await requireSupabase();
  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    null;
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta.picture === "string" && meta.picture.trim()) ||
    null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const nextDisplay =
    (existing?.display_name as string | null)?.trim() || displayName || null;
  const existingAvatar = (existing?.avatar_url as string | null) ?? null;
  const isUploaded =
    existingAvatar?.includes("/storage/v1/object/public/avatars/") ?? false;
  const nextAvatar = isUploaded ? existingAvatar : avatarUrl || existingAvatar;

  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? user.id,
    display_name: nextDisplay,
    avatar_url: nextAvatar,
    updated_at: new Date().toISOString(),
  });
}

export async function updateProfileAction(orgSlug: string, formData: FormData) {
  const ctx = await requireOrg(orgSlug);
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) return { error: "Display name is required" };
  if (displayName.length > 80) return { error: "Keep the name under 80 characters" };

  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      display_name: displayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.userId);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/profile`);
  return { ok: true as const };
}

export async function uploadAvatarAction(orgSlug: string, formData: FormData) {
  const ctx = await requireOrg(orgSlug);
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an image" };
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return { error: "Image must be under 5 MB" };
  }
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  if (file.type && !allowed.has(file.type)) {
    return { error: "Use PNG, JPEG, WebP, or GIF" };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const path = `${ctx.userId}/avatar.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await ctx.supabase.storage
    .from("avatars")
    .upload(path, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });
  if (uploadError) return { error: uploadError.message };

  const { data: pub } = ctx.supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.userId);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/profile`);
  return { ok: true as const, avatarUrl };
}

export async function removeAvatarAction(orgSlug: string) {
  const ctx = await requireOrg(orgSlug);
  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.userId);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/profile`);
  return { ok: true as const };
}
