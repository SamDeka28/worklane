import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_ORG_SLUGS } from "@/modules/identity/types";
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from "@/shared/db/env";

function invitePathFromSearch(url: URL): string | null {
  const invite = url.searchParams.get("invite");
  if (invite && /^[A-Za-z0-9_-]+$/.test(invite)) {
    return `/invite/${invite}`;
  }
  const next = url.searchParams.get("next");
  if (next?.startsWith("/invite/")) {
    const token = next.slice("/invite/".length).split(/[/?#]/)[0];
    if (token && /^[A-Za-z0-9_-]+$/.test(token)) {
      return `/invite/${token}`;
    }
  }
  return null;
}

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/invite");

  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const isOrgRoute = Boolean(firstSegment && !RESERVED_ORG_SLUGS.has(firstSegment));

  if (!user && (isOrgRoute || pathname.startsWith("/onboarding")) && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const switching = pathname === "/login" && request.nextUrl.searchParams.get("switch") === "1";
  if (user && !switching && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    const invitePath = invitePathFromSearch(url);
    if (invitePath) {
      url.pathname = invitePath;
      url.search = "";
      return NextResponse.redirect(url);
    }
    url.pathname = "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
