"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSupabase } from "@/shared/db/require-user";
import { requireWritableOrg } from "@/modules/identity/org";

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
