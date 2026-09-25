"use server";

import { requireUser } from "@/shared/db/require-user";
import { isThemeId } from "@/shared/theme/themes";

export async function updateThemeAction(theme: string) {
  if (!isThemeId(theme)) return { error: "Unknown theme" };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ theme })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}
