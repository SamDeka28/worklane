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
  const linkEmail = url.searchParams.get("email")?.trim().toLowerCase() || null;

  if (code) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const confirmed = error.code === "pkce_code_verifier_not_found";
        const {
          data: { user: current },
        } = await supabase.auth.getUser();
        if (confirmed && current && linkEmail && current.email?.toLowerCase() === linkEmail) {
          return NextResponse.redirect(new URL(next, url.origin));
        }

        const login = new URL("/login", url.origin);
        if (confirmed) login.searchParams.set("confirmed", "1");
        else login.searchParams.set("error", error.message);
        if (linkEmail) login.searchParams.set("email", linkEmail);
        if (current) login.searchParams.set("switch", "1");
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
