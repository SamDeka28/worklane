import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from "@/shared/db/env";

export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}
