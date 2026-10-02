import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { signJwt } from "@/modules/mcp/crypto";
import { ACCESS_TTL_SEC } from "@/modules/mcp/origin";
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from "@/shared/db/env";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";

/**
 * A Supabase client for the signed-in member.
 * When SUPABASE_JWT_SECRET is set, this is a short-lived user JWT so RLS applies.
 * Otherwise the service role is used, and every read must filter to an org the
 * member belongs to.
 */
export function createMemberSupabaseClient(userId: string): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Worklane isn't configured to connect assistants yet.");
  }
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    const accessToken = signJwt(
      {
        aud: "authenticated",
        role: "authenticated",
        sub: userId,
        iss: `${getSupabaseUrl()}/auth/v1`,
      },
      jwtSecret,
      ACCESS_TTL_SEC,
    );
    return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const admin = createAdminSupabaseClient();
  if (!admin) throw new Error("Worklane isn't configured to connect assistants yet.");
  return admin;
}
