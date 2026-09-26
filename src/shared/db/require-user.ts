import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/shared/db/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireSupabase() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  return supabase;
}

export type SessionUser = Pick<User, "id" | "email" | "user_metadata" | "app_metadata">;

/**
 * One verified session per request — shared by layout, pages, and query helpers.
 * `getClaims()` checks the JWT signature against the project's cached signing keys, so this
 * costs no Auth round trip (unlike `getUser()`).
 */
export const getSessionUser = cache(async (): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: SessionUser | null;
}> => {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { supabase: null, user: null };
  }
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null };
  return {
    supabase,
    user: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
      user_metadata: (claims.user_metadata as User["user_metadata"] | undefined) ?? {},
      app_metadata: (claims.app_metadata as User["app_metadata"] | undefined) ?? {},
    },
  };
});

export async function requireUser(): Promise<{
  supabase: SupabaseClient;
  user: SessionUser;
}> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) {
    redirect("/login");
  }
  return { supabase, user };
}
