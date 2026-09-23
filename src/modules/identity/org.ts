import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
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
  /** True until the member dismisses the first-join welcome. */
  needsWelcome: boolean;
  permissions: MemberPermissions;
  supabase: SupabaseClient;
  user: {
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
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

/** Membership list once per request. */
export const listMyOrgs = cache(async (): Promise<
  { org: Organization; role: OrgRole }[]
> => {
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
});

/** Org + membership + profile once per slug per request. */
export const requireOrg = cache(async (slug: string): Promise<OrgContext> => {
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

  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role, status, permissions, welcomed_at")
      .eq("organization_id", orgRow.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("email, display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

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

  return {
    org,
    role,
    userId: user.id,
    canWrite: roleCanWrite && (role === "owner" || role === "admin" || moduleWrite),
    needsWelcome: !membership.welcomed_at,
    permissions,
    supabase,
    user: {
      email: (profile?.email as string | null) ?? user.email ?? null,
      displayName:
        (profile?.display_name as string | null) ??
        (user.user_metadata?.full_name as string | undefined) ??
        null,
      avatarUrl:
        (profile?.avatar_url as string | null) ??
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null,
    },
  };
});

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

/** Writable org membership plus write access to a specific module. */
export async function requireModuleWrite(
  slug: string,
  module: ModuleKey,
): Promise<OrgContext> {
  const ctx = await requireWritableOrg(slug);
  if (!canWriteModule(ctx.permissions, module)) {
    throw new Error(`You do not have permission to change ${module}`);
  }
  return ctx;
}

export async function firstOrgPath(): Promise<string> {
  const orgs = await listMyOrgs();
  if (orgs.length === 0) {
    // Google / generic sign-in often skips /invite/[token] — claim open invites by email.
    const { claimPendingInvitationsForUser } = await import("@/modules/team/invites");
    const claimed = await claimPendingInvitationsForUser();
    if (claimed.length > 0) {
      const first = claimed[0];
      if (first.projectId) {
        return `/${first.orgSlug}/projects/${first.projectId}?joined=1`;
      }
      return `/${first.orgSlug}?joined=1`;
    }
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
  const profileMap = new Map<
    string,
    { email: string; displayName: string | null; avatarUrl: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .in("id", userIds);
    for (const profile of profiles ?? []) {
      profileMap.set(profile.id as string, {
        email: profile.email as string,
        displayName: (profile.display_name as string | null) ?? null,
        avatarUrl: (profile.avatar_url as string | null) ?? null,
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
      avatarUrl: profile?.avatarUrl ?? null,
      createdAt: row.created_at as string,
      isYou: row.user_id === userId,
      permissions: parseMemberPermissions(row.permissions),
    };
  });
}
