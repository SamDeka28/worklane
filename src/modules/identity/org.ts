import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import {
  DEFAULT_MODULES,
  type Organization,
  type OrgModules,
  type OrgRole,
} from "@/modules/identity/types";
import { requireUser } from "@/shared/db/require-user";

export type OrgContext = {
  org: Organization;
  role: OrgRole;
  userId: string;
  canWrite: boolean;
  supabase: SupabaseClient;
};

type OrgRow = {
  id: string;
  slug: string;
  name: string;
  default_currency: string;
  timezone: string;
  settings: { modules?: Partial<OrgModules> } | null;
};

export function mapOrganization(row: OrgRow): Organization {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    defaultCurrency: row.default_currency === "INR" ? "INR" : "USD",
    timezone: row.timezone,
    modules: { ...DEFAULT_MODULES, ...(row.settings?.modules ?? {}) },
  };
}

export async function listMyOrgs(): Promise<{ org: Organization; role: OrgRole }[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "role, organizations ( id, slug, name, default_currency, timezone, settings )",
    )
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => {
      const orgRow = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      if (!orgRow) return null;
      return {
        org: mapOrganization(orgRow as OrgRow),
        role: row.role as OrgRole,
      };
    })
    .filter((row): row is { org: Organization; role: OrgRole } => Boolean(row));
}

export async function requireOrg(slug: string): Promise<OrgContext> {
  const { supabase, user } = await requireUser();
  const { data: orgRow, error } = await supabase
    .from("organizations")
    .select("id, slug, name, default_currency, timezone, settings")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!orgRow) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", orgRow.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const role = membership.role as OrgRole;
  return {
    org: mapOrganization(orgRow as OrgRow),
    role,
    userId: user.id,
    canWrite: role === "owner" || role === "admin" || role === "member",
    supabase,
  };
}

export async function requireWritableOrg(slug: string): Promise<OrgContext> {
  const ctx = await requireOrg(slug);
  if (!ctx.canWrite) {
    throw new Error("You do not have permission to change this organization");
  }
  return ctx;
}

export async function firstOrgPath(): Promise<string> {
  const orgs = await listMyOrgs();
  if (orgs.length === 0) {
    return "/onboarding?empty=1";
  }
  return `/${orgs[0].org.slug}`;
}

export async function redirectToFirstOrg(): Promise<never> {
  redirect(await firstOrgPath());
}

export async function listOrgMembers(slug: string) {
  const { org, supabase, userId } = await requireOrg(slug);
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, role, status, user_id, created_at")
    .eq("organization_id", org.id)
    .order("created_at");
  if (error) throw new Error(error.message);

  const userIds = (data ?? []).map((row) => row.user_id as string);
  const profileMap = new Map<string, { email: string; displayName: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", userIds);
    for (const profile of profiles ?? []) {
      profileMap.set(profile.id as string, {
        email: profile.email as string,
        displayName: (profile.display_name as string | null) ?? null,
      });
    }
  }

  return (data ?? []).map((row) => {
    const profile = profileMap.get(row.user_id as string);
    return {
      id: row.id,
      role: row.role as OrgRole,
      status: row.status as string,
      userId: row.user_id as string,
      email: profile?.email ?? null,
      displayName: profile?.displayName ?? null,
      createdAt: row.created_at as string,
      isYou: row.user_id === userId,
    };
  });
}
