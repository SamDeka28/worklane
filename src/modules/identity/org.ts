import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  canAccessModule,
  canWriteModule,
  parseMemberPermissions,
  resolveMemberPermissions,
  type MemberPermissions,
} from "@/modules/identity/permissions";
import {
  DEFAULT_MODULES,
  type ModuleKey,
  type Organization,
  type OrgModules,
  type OrgRole,
} from "@/modules/identity/types";
import { requireUser } from "@/shared/db/require-user";

export const LAST_ORG_COOKIE = "worklane_last_org";

export type OrgContext = {
  org: Organization;
  role: OrgRole;
  userId: string;
  canWrite: boolean;
  permissions: MemberPermissions;
  supabase: SupabaseClient;
  user: {
    email: string | null;
    displayName: string | null;
  };
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
    .select("role, status, permissions")
    .eq("organization_id", orgRow.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const role = membership.role as OrgRole;
  const org = mapOrganization(orgRow as OrgRow);
  const permissions = resolveMemberPermissions({
    role,
    stored: parseMemberPermissions(membership.permissions),
    orgModules: org.modules,
  });

  const roleCanWrite = role === "owner" || role === "admin" || role === "member";
  const moduleWrite =
    canWriteModule(permissions, "delivery") ||
    canWriteModule(permissions, "finance") ||
    canWriteModule(permissions, "crm") ||
    canWriteModule(permissions, "documents") ||
    canWriteModule(permissions, "partners");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    org,
    role,
    userId: user.id,
    canWrite: roleCanWrite && (role === "owner" || role === "admin" || moduleWrite),
    permissions,
    supabase,
    user: {
      email: (profile?.email as string | null) ?? user.email ?? null,
      displayName:
        (profile?.display_name as string | null) ??
        (user.user_metadata?.full_name as string | undefined) ??
        null,
    },
  };
}

export function requireModuleAccess(ctx: OrgContext, module: ModuleKey) {
  if (!canAccessModule(ctx.permissions, module)) {
    notFound();
  }
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
  try {
    const jar = await cookies();
    const last = jar.get(LAST_ORG_COOKIE)?.value;
    if (last && orgs.some((row) => row.org.slug === last)) {
      return `/${last}`;
    }
  } catch {
    /* cookies unavailable */
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
    .select("id, role, status, user_id, created_at, permissions")
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
      permissions: parseMemberPermissions(row.permissions),
    };
  });
}
