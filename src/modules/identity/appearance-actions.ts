"use server";

import { requireUser } from "@/shared/db/require-user";
import { isComponentStyle, isInterfaceStyle, isSurfaceStyle } from "@/shared/theme/styles";
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

export async function updateAppearanceStylesAction(input: {
  surface?: string;
  component?: string;
  interface?: string;
}) {
  const patch: { surface_style?: string; component_style?: string; interface_style?: string } = {};
  if (input.surface !== undefined) {
    if (!isSurfaceStyle(input.surface)) return { error: "Unknown surface style" };
    patch.surface_style = input.surface;
  }
  if (input.component !== undefined) {
    if (!isComponentStyle(input.component)) return { error: "Unknown component style" };
    patch.component_style = input.component;
  }
  if (input.interface !== undefined) {
    if (!isInterfaceStyle(input.interface)) return { error: "Unknown interface style" };
    patch.interface_style = input.interface;
  }
  if (!Object.keys(patch).length) return { ok: true as const };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}
