import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/shared/db/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const login = new URL("/login", url.origin);
        login.searchParams.set("error", error.message);
        return NextResponse.redirect(login);
      }
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
