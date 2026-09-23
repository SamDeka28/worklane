"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireWritableOrg } from "@/modules/identity/org";
import type { OrgInvitation } from "@/modules/team/types";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import {
  getAppUrl,
  inviteEmailHtml,
  notificationEmailHtml,
  sendEmail,
} from "@/shared/email";

export type { OrgInvitation };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newInviteToken() {
  return randomBytes(24).toString("base64url");
}

export async function listPendingInvitations(orgSlug: string): Promise<OrgInvitation[]> {
  const { requireOrg } = await import("@/modules/identity/org");
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("organization_invitations")
    .select("id, email, role, project_id, project_role, partner_id, expires_at, created_at")
    .eq("organization_id", ctx.org.id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.message.includes("organization_invitations")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    role: row.role as string,
    projectId: (row.project_id as string | null) ?? null,
    projectRole: (row.project_role as string | null) ?? null,
    partnerId: (row.partner_id as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function inviteOrgMemberAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only owners and admins can invite" };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(formData.get("role") ?? "member");
  const role =
    roleRaw === "admin" || roleRaw === "viewer" || roleRaw === "partner" || roleRaw === "member"
      ? roleRaw
      : "member";
  const projectId = String(formData.get("project_id") ?? "").trim() || null;
  const projectRole =
    String(formData.get("project_role") ?? "member") === "lead" ? "lead" : "member";
  const partnerId = String(formData.get("partner_id") ?? "").trim() || null;
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const presetRaw = String(formData.get("permissions_preset") ?? "full");
  const permissionsJson = String(formData.get("permissions") ?? "").trim();
  const { permissionsPreset, parseMemberPermissions } = await import(
    "@/modules/identity/permissions"
  );
  let permissions =
    presetRaw === "progress"
      ? permissionsPreset("progress")
      : presetRaw === "partner" || role === "partner"
        ? permissionsPreset("partner")
        : presetRaw === "custom"
          ? parseMemberPermissions(permissionsJson ? JSON.parse(permissionsJson) : null) ??
            permissionsPreset("full")
          : permissionsPreset("full");
  if (role === "partner" && presetRaw === "full") {
    permissions = permissionsPreset("partner");
  }

  if (!email || !email.includes("@")) return { error: "Enter a valid email" };

  if (partnerId) {
    const { data: partner } = await ctx.supabase
      .from("partners")
      .select("id, email")
      .eq("id", partnerId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!partner) return { error: "Partner not found" };
  }

  let projectName: string | null = null;
  if (projectId) {
    const { data: project } = await ctx.supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (!project) return { error: "Project not found" };
    projectName = project.name as string;
  }

  // Already a member?
  const admin = createAdminSupabaseClient();
  if (admin) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (profile?.id) {
      const { data: existing } = await ctx.supabase
        .from("organization_members")
        .select("id, status")
        .eq("organization_id", ctx.org.id)
        .eq("user_id", profile.id)
        .maybeSingle();
      if (existing?.status === "active") {
        if (partnerId) {
          await ctx.supabase
            .from("partners")
            .update({ user_id: profile.id, email })
            .eq("id", partnerId)
            .eq("organization_id", ctx.org.id);
          await notifyUser({
            userId: profile.id,
            organizationId: ctx.org.id,
            title: `Linked as partner in ${ctx.org.name}`,
            body: displayName
              ? `Your partner profile “${displayName}” is linked in ${ctx.org.name}.`
              : `You were linked as a partner in ${ctx.org.name}.`,
            href: `${getAppUrl()}/${orgSlug}/partners`,
            email,
          });
          revalidatePath(`/${orgSlug}/partners`);
          revalidatePath(`/${orgSlug}/team`);
          return { ok: true as const, alreadyMember: true as const };
        }
        if (projectId) {
          await ctx.supabase.from("project_members").upsert(
            {
              organization_id: ctx.org.id,
              project_id: projectId,
              user_id: profile.id,
              role: projectRole,
            },
            { onConflict: "project_id,user_id" },
          );
          await notifyUser({
            userId: profile.id,
            organizationId: ctx.org.id,
            title: `Added to ${projectName}`,
            body: `You were added to ${projectName} in ${ctx.org.name}.`,
            href: `${getAppUrl()}/${orgSlug}/projects/${projectId}`,
            email,
          });
          revalidatePath(`/${orgSlug}/projects/${projectId}`);
          revalidatePath(`/${orgSlug}/team`);
          revalidatePath(`/${orgSlug}/settings`);
          return { ok: true as const, alreadyMember: true as const };
        }
        return { error: "That person is already a studio member" };
      }
    }
  }

  const token = newInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  await ctx.supabase
    .from("organization_invitations")
    .delete()
    .eq("organization_id", ctx.org.id)
    .ilike("email", email)
    .is("accepted_at", null);

  const { error } = await ctx.supabase.from("organization_invitations").insert({
    organization_id: ctx.org.id,
    email,
    role,
    invited_by: ctx.userId,
    expires_at: expiresAt,
    token_hash: tokenHash,
    project_id: projectId,
    project_role: projectId ? projectRole : null,
    partner_id: partnerId,
    permissions,
  });
  if (error) return { error: error.message };

  const acceptUrl = `${getAppUrl()}/invite/${token}`;
  const inviter =
    (await profileLabel(ctx.userId)) || ctx.org.name;

  const mailed = await sendEmail({
    to: email,
    subject: projectName
      ? `Join ${projectName} on ${ctx.org.name}`
      : role === "partner"
        ? `Join ${ctx.org.name} as a partner`
        : `Join ${ctx.org.name} on Worklane`,
    html: inviteEmailHtml({
      orgName: ctx.org.name,
      inviterLabel: inviter,
      role,
      acceptUrl,
      projectName,
    }),
    text: `You're invited to ${ctx.org.name} as ${role}. Accept: ${acceptUrl}`,
  });

  if (!mailed.ok) {
    if (!mailed.skipped) {
      return { error: `Invite saved but email failed: ${mailed.error}` };
    }
  }

  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/team`);
  revalidatePath(`/${orgSlug}/partners`);
  if (projectId) revalidatePath(`/${orgSlug}/projects/${projectId}`);
  return {
    ok: true as const,
    emailed: mailed.ok,
    acceptUrl: !mailed.ok && mailed.skipped ? acceptUrl : undefined,
  };
}

export async function revokeInvitationAction(orgSlug: string, invitationId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only owners and admins can revoke invites" };
  }
  const { error } = await ctx.supabase
    .from("organization_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("organization_id", ctx.org.id)
    .is("accepted_at", null);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/team`);
  revalidatePath(`/${orgSlug}/partners`);
  return { ok: true as const };
}

export async function updateMemberAccessAction(
  orgSlug: string,
  memberId: string,
  formData: FormData,
) {
  const ctx = await requireWritableOrg(orgSlug);
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only owners and admins can edit access" };
  }

  const roleRaw = String(formData.get("role") ?? "member");
  const role =
    roleRaw === "admin" || roleRaw === "viewer" || roleRaw === "partner" || roleRaw === "member"
      ? roleRaw
      : "member";
  const presetRaw = String(formData.get("permissions_preset") ?? "custom");
  const permissionsJson = String(formData.get("permissions") ?? "").trim();
  const { permissionsPreset, parseMemberPermissions } = await import(
    "@/modules/identity/permissions"
  );

  let permissions =
    presetRaw === "progress"
      ? permissionsPreset("progress")
      : presetRaw === "partner" || role === "partner"
        ? permissionsPreset("partner")
        : presetRaw === "full"
          ? permissionsPreset("full")
          : parseMemberPermissions(permissionsJson ? JSON.parse(permissionsJson) : null) ??
            permissionsPreset("full");
  if (role === "partner" && presetRaw === "full") {
    permissions = permissionsPreset("partner");
  }

  const { data: member, error: loadError } = await ctx.supabase
    .from("organization_members")
    .select("id, user_id, role, status")
    .eq("id", memberId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!member) return { error: "Member not found" };
  if (member.status !== "active") return { error: "Member is not active" };

  if (member.role === "owner") {
    return { error: "Owner access can’t be changed here" };
  }
  if (ctx.role === "admin" && (member.role === "admin" || role === "admin")) {
    return { error: "Only owners can change admin access" };
  }

  const { error } = await ctx.supabase
    .from("organization_members")
    .update({ role, permissions })
    .eq("id", memberId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/team`);
  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/projects`);
  return { ok: true as const };
}

export async function resendInvitationAction(orgSlug: string, invitationId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only owners and admins can resend invites" };
  }

  const { data: invite, error: loadError } = await ctx.supabase
    .from("organization_invitations")
    .select("id, email, role, project_id, partner_id, accepted_at")
    .eq("id", invitationId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!invite) return { error: "Invite not found" };
  if (invite.accepted_at) return { error: "Invite already accepted" };

  let projectName: string | null = null;
  if (invite.project_id) {
    const { data: project } = await ctx.supabase
      .from("projects")
      .select("name")
      .eq("id", invite.project_id)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    projectName = (project?.name as string | null) ?? null;
  }

  const token = newInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  const { error: updateError } = await ctx.supabase
    .from("organization_invitations")
    .update({
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .eq("id", invite.id)
    .eq("organization_id", ctx.org.id)
    .is("accepted_at", null);
  if (updateError) return { error: updateError.message };

  const acceptUrl = `${getAppUrl()}/invite/${token}`;
  const inviter = (await profileLabel(ctx.userId)) || ctx.org.name;
  const role = invite.role as string;
  const email = invite.email as string;

  const mailed = await sendEmail({
    to: email,
    subject: projectName
      ? `Join ${projectName} on ${ctx.org.name}`
      : role === "partner"
        ? `Join ${ctx.org.name} as a partner`
        : `Join ${ctx.org.name} on Worklane`,
    html: inviteEmailHtml({
      orgName: ctx.org.name,
      inviterLabel: inviter,
      role,
      acceptUrl,
      projectName,
    }),
    text: `You're invited to ${ctx.org.name} as ${role}. Accept: ${acceptUrl}`,
  });

  if (!mailed.ok && !mailed.skipped) {
    return { error: `Invite updated but email failed: ${mailed.error}` };
  }

  revalidatePath(`/${orgSlug}/team`);
  revalidatePath(`/${orgSlug}/partners`);
  revalidatePath(`/${orgSlug}/settings`);
  return {
    ok: true as const,
    emailed: mailed.ok,
    acceptUrl: !mailed.ok && mailed.skipped ? acceptUrl : undefined,
  };
}

export async function getInvitationByToken(token: string) {
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

type InvitationRow = NonNullable<Awaited<ReturnType<typeof getInvitationByToken>>>;

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

  revalidatePath(`/${invite.org!.slug}`);
  revalidatePath(`/${invite.org!.slug}/projects`);
  revalidatePath(`/${invite.org!.slug}/team`);
  revalidatePath(`/${invite.org!.slug}/partners`);
  if (invite.projectId) {
    revalidatePath(`/${invite.org!.slug}/projects/${invite.projectId}`);
  }

  return {
    ok: true as const,
    orgSlug: invite.org!.slug,
    orgName: invite.org!.name,
    projectId: invite.projectId,
  };
}

export async function acceptInvitationAction(token: string) {
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

  // Fallback when RPC missing / older DB — needs service role.
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return {
      error: rpcError?.message || "Could not accept invite. Try again or contact the studio owner.",
    };
  }

  const invite = await getInvitationByToken(token);
  if (!invite || !invite.org) return { error: "Invite not found" };

  const userEmail = (user.email ?? "").trim().toLowerCase();
  if (!userEmail || userEmail !== invite.email.toLowerCase()) {
    return {
      error: `Sign in as ${invite.email} to accept this invite`,
      expectedEmail: invite.email,
    };
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now() && !invite.acceptedAt) {
    return { error: "Invite expired" };
  }

  // Re-attach even if invite was already marked accepted (account recreated).
  const result = await fulfillInvitation(admin, invite, user);
  if ("ok" in result && result.ok) {
    return {
      ...result,
      alreadyAccepted: Boolean(invite.acceptedAt),
    };
  }
  return result;
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

async function profileLabel(userId: string) {
  const admin = createAdminSupabaseClient();
  if (!admin) return null;
  const { data } = await admin
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();
  return (data?.display_name as string | null) || (data?.email as string | null) || null;
}

export async function notifyUser(input: {
  userId: string;
  organizationId?: string | null;
  title: string;
  body: string;
  href?: string | null;
  email?: string | null;
  sendMail?: boolean;
}) {
  const admin = createAdminSupabaseClient();
  if (!admin) return;

  const { data: row } = await admin
    .from("notifications")
    .insert({
      organization_id: input.organizationId ?? null,
      user_id: input.userId,
      kind: "info",
      title: input.title,
      body: input.body,
      href: input.href ?? null,
    })
    .select("id")
    .single();

  if (input.sendMail === false) return;

  let email = input.email ?? null;
  if (!email) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", input.userId)
      .maybeSingle();
    email = (profile?.email as string | null) ?? null;
  }
  if (!email) return;

  const mailed = await sendEmail({
    to: email,
    subject: input.title,
    html: notificationEmailHtml({
      title: input.title,
      body: input.body,
      href: input.href,
    }),
    text: `${input.title}\n\n${input.body}${input.href ? `\n\n${input.href}` : ""}`,
  });

  if (mailed.ok && row?.id) {
    await admin
      .from("notifications")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}

export async function listNotificationsForUser(limit = 30) {
  const { requireUser } = await import("@/shared/db/require-user");
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, href, read_at, created_at, organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message.includes("notifications")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    href: (row.href as string | null) ?? null,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
    organizationId: (row.organization_id as string | null) ?? null,
  }));
}

export async function markNotificationReadAction(notificationId: string) {
  const { requireUser } = await import("@/shared/db/require-user");
  const { supabase, user } = await requireUser();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);
  return { ok: true as const };
}
