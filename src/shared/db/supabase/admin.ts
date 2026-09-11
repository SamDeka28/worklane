import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, isSupabaseConfigured } from "@/shared/db/env";

/** Service-role client for portal token lookups (bypasses RLS). Server-only. */
export function createAdminSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
  if (!key) return null;
  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
