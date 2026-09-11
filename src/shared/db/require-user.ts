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

export async function getSessionUser(): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: User | null;
}> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { supabase: null, user: null };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function requireUser(): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) {
    redirect("/login");
  }
  return { supabase, user };
}
