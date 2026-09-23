import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type InvitationPreview = {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  projectId: string | null;
  projectRole: string | null;
  partnerId: string | null;
  permissions: unknown;
  expiresAt: string | null;
  acceptedAt: string | null;
  org: { id: string; slug: string; name: string } | null;
};

export async function getInvitationByToken(token: string): Promise<InvitationPreview | null> {
  const tokenHash = hashToken(token);

  // Prefer RPC so invite pages work without SUPABASE_SERVICE_ROLE_KEY (e.g. Vercel).
  const { createServerSupabaseClient } = await import("@/shared/db/supabase/server");
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.rpc("preview_organization_invitation", {
      p_token_hash: tokenHash,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row) {
      return {
        id: row.id as string,
        email: row.email as string,
        role: row.role as string,
        organizationId: row.organization_id as string,
        projectId: (row.project_id as string | null) ?? null,
        projectRole: (row.project_role as string | null) ?? null,
        partnerId: (row.partner_id as string | null) ?? null,
        permissions: row.permissions ?? null,
        expiresAt: (row.expires_at as string | null) ?? null,
        acceptedAt: (row.accepted_at as string | null) ?? null,
        org: {
          id: row.org_id as string,
          slug: row.org_slug as string,
          name: row.org_name as string,
        },
      };
    }
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("organization_invitations")
    .select(
      "id, email, role, organization_id, project_id, project_role, partner_id, permissions, expires_at, accepted_at, organizations ( id, slug, name )",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  return {
    id: data.id as string,
    email: data.email as string,
    role: data.role as string,
    organizationId: data.organization_id as string,
    projectId: (data.project_id as string | null) ?? null,
    projectRole: (data.project_role as string | null) ?? null,
    partnerId: (data.partner_id as string | null) ?? null,
    permissions: data.permissions ?? null,
    expiresAt: (data.expires_at as string | null) ?? null,
    acceptedAt: (data.accepted_at as string | null) ?? null,
    org: org
      ? { id: org.id as string, slug: org.slug as string, name: org.name as string }
      : null,
  };
}

type InvitationRow = InvitationPreview & {
  org: { id: string; slug: string; name: string };
};

async function fulfillInvitation(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  invite: InvitationRow,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
) {
  const userEmail = (user.email ?? "").trim().toLowerCase();

  const { error: memberError } = await admin.from("organization_members").upsert(
    {
      organization_id: invite.organizationId,
      user_id: user.id,
      role: invite.role,
      status: "active",
      permissions: invite.permissions,
    },
    { onConflict: "organization_id,user_id" },
  );
  if (memberError) return { error: memberError.message };

  if (invite.projectId) {
    const { error: projectMemberError } = await admin.from("project_members").upsert(
      {
        organization_id: invite.organizationId,
        project_id: invite.projectId,
        user_id: user.id,
        role: invite.projectRole === "lead" ? "lead" : "member",
      },
      { onConflict: "project_id,user_id" },
    );
    if (projectMemberError) {
      return { error: `Joined studio, but project access failed: ${projectMemberError.message}` };
    }
  }

  if (invite.partnerId) {
    const { error: partnerError } = await admin
      .from("partners")
      .update({ user_id: user.id, email: userEmail })
      .eq("id", invite.partnerId)
      .eq("organization_id", invite.organizationId);
    if (partnerError) {
      return { error: `Joined studio, but partner link failed: ${partnerError.message}` };
    }
  }

  await admin
    .from("organization_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  await admin.from("profiles").upsert({
    id: user.id,
    email: userEmail,
    display_name:
      (typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null) ?? userEmail.split("@")[0],
  });

  revalidatePath(`/${invite.org.slug}`);
  revalidatePath(`/${invite.org.slug}/projects`);
  revalidatePath(`/${invite.org.slug}/team`);
  revalidatePath(`/${invite.org.slug}/partners`);
  if (invite.projectId) {
    revalidatePath(`/${invite.org.slug}/projects/${invite.projectId}`);
  }

  return {
    ok: true as const,
    orgSlug: invite.org.slug,
    orgName: invite.org.name,
    projectId: invite.projectId,
  };
}

export type AcceptInvitationResult =
  | {
      ok: true;
      alreadyAccepted?: boolean;
      orgSlug: string;
      orgName: string;
      projectId: string | null;
    }
  | { ok: false; error: string; expectedEmail?: string };

/** Accept invite for the signed-in user. Safe to call from Server Components (not a server action). */
export async function acceptInvitation(token: string): Promise<AcceptInvitationResult> {
  const { requireUser } = await import("@/shared/db/require-user");
  const { user, supabase } = await requireUser();
  const tokenHash = hashToken(token);

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "accept_organization_invitation",
    { p_token_hash: tokenHash },
  );

  if (!rpcError) {
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (row?.org_slug) {
      const orgSlug = row.org_slug as string;
      const projectId = (row.project_id as string | null) ?? null;
      revalidatePath(`/${orgSlug}`);
      revalidatePath(`/${orgSlug}/projects`);
      revalidatePath(`/${orgSlug}/team`);
      if (projectId) revalidatePath(`/${orgSlug}/projects/${projectId}`);
      return {
        ok: true as const,
        alreadyAccepted: Boolean(row.already_member),
        orgSlug,
        orgName: row.org_name as string,
        projectId,
      };
    }
  }

  const admin = createAdminSupabaseClient();
  if (!admin) {
    return {
      ok: false as const,
      error: rpcError?.message || "Could not accept invite. Try again or contact the studio owner.",
    };
  }

  const invite = await getInvitationByToken(token);
  if (!invite || !invite.org) return { ok: false as const, error: "Invite not found" };

  const userEmail = (user.email ?? "").trim().toLowerCase();
  if (!userEmail || userEmail !== invite.email.toLowerCase()) {
    return {
      ok: false as const,
      error: `Sign in as ${invite.email} to accept this invite`,
      expectedEmail: invite.email,
    };
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now() && !invite.acceptedAt) {
    return { ok: false as const, error: "Invite expired" };
  }

  const result = await fulfillInvitation(admin, { ...invite, org: invite.org }, user);
  if ("ok" in result && result.ok) {
    return {
      ...result,
      alreadyAccepted: Boolean(invite.acceptedAt),
    };
  }
  return { ok: false as const, error: result.error };
}

/** Claim open (or orphaned) invites for the signed-in email. */
export async function claimPendingInvitationsForUser() {
  const { getSessionUser } = await import("@/shared/db/require-user");
  const { user, supabase } = await getSessionUser();
  if (!user?.email || !supabase) {
    return [] as { orgSlug: string; orgName: string; projectId: string | null }[];
  }

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "claim_my_organization_invitations",
  );

  if (!rpcError && rpcRows) {
    const rows = Array.isArray(rpcRows) ? rpcRows : [rpcRows];
    const claimed = rows
      .filter((row) => row?.org_slug)
      .map((row) => ({
        orgSlug: row.org_slug as string,
        orgName: row.org_name as string,
        projectId: (row.project_id as string | null) ?? null,
      }));
    for (const c of claimed) {
      revalidatePath(`/${c.orgSlug}`);
      revalidatePath(`/${c.orgSlug}/team`);
    }
    return claimed;
  }

  const admin = createAdminSupabaseClient();
  if (!admin) return [];

  const userEmail = user.email.trim().toLowerCase();
  const { data: rows } = await admin
    .from("organization_invitations")
    .select(
      "id, email, role, organization_id, project_id, project_role, partner_id, permissions, expires_at, accepted_at, organizations ( id, slug, name )",
    )
    .ilike("email", userEmail)
    .order("created_at", { ascending: false });

  const claimed: { orgSlug: string; orgName: string; projectId: string | null }[] = [];
  const seenOrgs = new Set<string>();

  for (const row of rows ?? []) {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (!org) continue;
    const orgId = row.organization_id as string;
    if (seenOrgs.has(orgId)) continue;

    const { data: existing } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (existing) {
      seenOrgs.add(orgId);
      continue;
    }

    if (
      !row.accepted_at &&
      row.expires_at &&
      new Date(row.expires_at as string).getTime() < Date.now()
    ) {
      continue;
    }

    const invite: InvitationRow = {
      id: row.id as string,
      email: row.email as string,
      role: row.role as string,
      organizationId: orgId,
      projectId: (row.project_id as string | null) ?? null,
      projectRole: (row.project_role as string | null) ?? null,
      partnerId: (row.partner_id as string | null) ?? null,
      permissions: row.permissions ?? null,
      expiresAt: (row.expires_at as string | null) ?? null,
      acceptedAt: (row.accepted_at as string | null) ?? null,
      org: { id: org.id as string, slug: org.slug as string, name: org.name as string },
    };

    const result = await fulfillInvitation(admin, invite, user);
    if ("ok" in result && result.ok) {
      seenOrgs.add(orgId);
      claimed.push({
        orgSlug: result.orgSlug,
        orgName: result.orgName,
        projectId: result.projectId,
      });
    }
  }

  return claimed;
}
