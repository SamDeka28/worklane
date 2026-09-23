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
    .select("id, email, role, project_id, project_ids, project_role, partner_id, expires_at, created_at")
    .eq("organization_id", ctx.org.id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.message.includes("organization_invitations")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => {
    const ids = Array.isArray(row.project_ids)
      ? (row.project_ids as string[]).filter(Boolean)
      : row.project_id
        ? [row.project_id as string]
        : [];
    return {
      id: row.id as string,
      email: row.email as string,
      role: row.role as string,
      projectId: (ids[0] ?? null) as string | null,
      projectIds: ids,
      projectRole: (row.project_role as string | null) ?? null,
      partnerId: (row.partner_id as string | null) ?? null,
      expiresAt: (row.expires_at as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
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
  const projectIds = formData
    .getAll("project_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
  // Legacy single field (project page invite).
  const legacyProjectId = String(formData.get("project_id") ?? "").trim();
  if (legacyProjectId && !projectIds.includes(legacyProjectId)) {
    projectIds.push(legacyProjectId);
  }
  const projectId = projectIds[0] ?? null;
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

  let projectNames: string[] = [];
  if (projectIds.length > 0) {
    const { data: projects } = await ctx.supabase
      .from("projects")
      .select("id, name")
      .eq("organization_id", ctx.org.id)
      .in("id", projectIds);
    const found = new Set((projects ?? []).map((p) => p.id as string));
    if (found.size !== projectIds.length) return { error: "One or more projects were not found" };
    projectNames = (projects ?? []).map((p) => p.name as string);
  }
  const projectName =
    projectNames.length === 0
      ? null
      : projectNames.length === 1
        ? projectNames[0]
        : `${projectNames.length} projects`;

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
        if (projectIds.length > 0) {
          await ctx.supabase.from("project_members").upsert(
            projectIds.map((pid) => ({
              organization_id: ctx.org.id,
              project_id: pid,
              user_id: profile.id,
              role: projectRole,
            })),
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
          for (const pid of projectIds) {
            revalidatePath(`/${orgSlug}/projects/${pid}`);
          }
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
    project_ids: projectIds,
    project_role: projectIds.length > 0 ? projectRole : null,
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
  for (const pid of projectIds) {
    revalidatePath(`/${orgSlug}/projects/${pid}`);
  }
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
  const { getInvitationByToken: get } = await import("@/modules/team/invites");
  return get(token);
}

export async function acceptInvitationAction(token: string) {
  const { acceptInvitation } = await import("@/modules/team/invites");
  return acceptInvitation(token);
}

export async function claimPendingInvitationsForUser() {
  const { claimPendingInvitationsForUser: claim } = await import("@/modules/team/invites");
  return claim();
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
