import { NextResponse } from "next/server";
import { syncProfileFromAuthUser } from "@/modules/identity/actions";
import { createServerSupabaseClient } from "@/shared/db/supabase/server";

function safeNextPath(raw: string | null, origin: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/onboarding";
  }
  try {
    const resolved = new URL(raw, origin);
    if (resolved.origin !== origin) return "/onboarding";
    return `${resolved.pathname}${resolved.search}`;
  } catch {
    return "/onboarding";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), url.origin);

  if (code) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const login = new URL("/login", url.origin);
        login.searchParams.set("error", error.message);
        if (next.startsWith("/invite/")) {
          login.searchParams.set("invite", next.slice("/invite/".length).split("?")[0] ?? "");
        }
        return NextResponse.redirect(login);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          await syncProfileFromAuthUser(user);
        } catch {
          // Non-blocking — session still works without profile sync.
        }
      }
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
