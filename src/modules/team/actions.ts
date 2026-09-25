"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireOrg } from "@/modules/identity/org";
import {
  canManageTeam,
  grantViolation,
  type MemberPermissions,
} from "@/modules/identity/permissions";
import { notify, userLabel } from "@/modules/notifications/service";
import type { NotificationCategory } from "@/modules/notifications/types";
import type { OrgInvitation } from "@/modules/team/types";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import {
  getAppUrl,
  inviteEmailHtml,
  inviteEmailText,
  roleLabel,
  sendEmail,
} from "@/shared/email";

export type { OrgInvitation };

type TeamGate =
  | { error: string }
  | {
      ctx: Awaited<ReturnType<typeof requireOrg>>;
      db: Awaited<ReturnType<typeof requireOrg>>["supabase"];
      elevated: boolean;
    };

/**
 * Owners/admins act through their own RLS-scoped client. Members granted "Manage team"
 * are not allowed by RLS, so their writes use the service client after the guardrails
 * in each action (no admins, no self, no grants beyond their own access).
 */
async function requireTeamManager(orgSlug: string): Promise<TeamGate> {
  const ctx = await requireOrg(orgSlug);
  if (!canManageTeam(ctx)) return { error: "You don’t have permission to manage the team" };
  const elevated = ctx.role === "owner" || ctx.role === "admin";
  if (elevated) return { ctx, db: ctx.supabase, elevated };
  const admin = createAdminSupabaseClient();
  if (!admin) return { error: "Team management for members needs the service key configured" };
  return { ctx, db: admin as typeof ctx.supabase, elevated };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newInviteToken() {
  return randomBytes(24).toString("base64url");
}

/** "Manage team" is independent of presets; only members can hold it (admins have it implicitly). */
function withTeamFlag(permissions: MemberPermissions, formData: FormData, role: string) {
  const next: MemberPermissions = { ...permissions };
  delete next.team;
  if (role === "member" && String(formData.get("manage_team") ?? "") === "1") {
    next.team = { access: "write" };
  }
  return next;
}

function grantGuard(
  ctx: Awaited<ReturnType<typeof requireOrg>>,
  elevated: boolean,
  role: string,
  permissions: MemberPermissions,
): string | null {
  if (elevated) return null;
  if (role === "admin") return "Only owners can make someone an admin";
  return grantViolation(permissions, ctx.permissions);
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
  const gate = await requireTeamManager(orgSlug);
  if ("error" in gate) return { error: gate.error };
  const { ctx, db, elevated } = gate;

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
  const { permissionsPreset, parseMemberPermissions, readOnlyPermissions } = await import(
    "@/modules/identity/permissions"
  );
  let permissions =
    presetRaw === "progress"
      ? permissionsPreset("progress")
      : presetRaw === "partner"
        ? permissionsPreset("partner")
        : presetRaw === "custom"
          ? parseMemberPermissions(permissionsJson ? JSON.parse(permissionsJson) : null) ??
            permissionsPreset("full")
          : permissionsPreset("full");
  if (role === "partner") permissions = readOnlyPermissions(permissions);
  permissions = withTeamFlag(permissions, formData, role);
  const denied = grantGuard(ctx, elevated, role, permissions);
  if (denied) return { error: denied };
  if (partnerId && !elevated && ctx.permissions.partners?.access !== "write") {
    return { error: "You need Partners edit access to link a partner login" };
  }

  if (!email || !email.includes("@")) return { error: "Enter a valid email" };

  if (partnerId) {
    const { data: partner } = await db
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
      const { data: existing } = await db
        .from("organization_members")
        .select("id, status")
        .eq("organization_id", ctx.org.id)
        .eq("user_id", profile.id)
        .maybeSingle();
      if (existing?.status === "active") {
        if (partnerId) {
          await db
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
            category: "partners",
            actorId: ctx.userId,
          });
          revalidatePath(`/${orgSlug}/partners`);
          revalidatePath(`/${orgSlug}/team`);
          return { ok: true as const, alreadyMember: true as const };
        }
        if (projectIds.length > 0) {
          await db.from("project_members").upsert(
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
            category: "projects",
            actorId: ctx.userId,
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

  await db
    .from("organization_invitations")
    .delete()
    .eq("organization_id", ctx.org.id)
    .ilike("email", email)
    .is("accepted_at", null);

  const { error } = await db.from("organization_invitations").insert({
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

  const inviteInput = {
    orgName: ctx.org.name,
    inviterLabel: inviter,
    role,
    acceptUrl,
    projectName,
  };
  const mailed = await sendEmail({
    to: email,
    subject: projectName
      ? `Join ${projectName} on ${ctx.org.name}`
      : role === "partner"
        ? `Join ${ctx.org.name} as a partner`
        : `Join ${ctx.org.name} on Worklane`,
    html: inviteEmailHtml(inviteInput),
    text: inviteEmailText(inviteInput),
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
  const gate = await requireTeamManager(orgSlug);
  if ("error" in gate) return { error: gate.error };
  const { ctx, db, elevated } = gate;
  if (!elevated) {
    const { data: invite } = await db
      .from("organization_invitations")
      .select("role")
      .eq("id", invitationId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    if (invite?.role === "admin") return { error: "Only owners and admins can revoke admin invites" };
  }
  const { error } = await db
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
  const gate = await requireTeamManager(orgSlug);
  if ("error" in gate) return { error: gate.error };
  const { ctx, db, elevated } = gate;

  const roleRaw = String(formData.get("role") ?? "member");
  const role =
    roleRaw === "admin" || roleRaw === "viewer" || roleRaw === "partner" || roleRaw === "member"
      ? roleRaw
      : "member";
  const presetRaw = String(formData.get("permissions_preset") ?? "custom");
  const permissionsJson = String(formData.get("permissions") ?? "").trim();
  const { permissionsPreset, parseMemberPermissions, readOnlyPermissions } = await import(
    "@/modules/identity/permissions"
  );

  let permissions =
    presetRaw === "progress"
      ? permissionsPreset("progress")
      : presetRaw === "partner"
        ? permissionsPreset("partner")
        : presetRaw === "full"
          ? permissionsPreset("full")
          : parseMemberPermissions(permissionsJson ? JSON.parse(permissionsJson) : null) ??
            permissionsPreset("full");
  if (role === "partner") permissions = readOnlyPermissions(permissions);
  permissions = withTeamFlag(permissions, formData, role);

  const { data: member, error: loadError } = await db
    .from("organization_members")
    .select("id, user_id, role, status, permissions")
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
  if (!elevated) {
    if (member.user_id === ctx.userId) return { error: "You can’t change your own access" };
    if (member.role === "admin") return { error: "Only owners can change admin access" };
  }
  const denied = grantGuard(ctx, elevated, role, permissions);
  if (denied) return { error: denied };

  const { error } = await db
    .from("organization_members")
    .update({ role, permissions })
    .eq("id", memberId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };

  const projectIds = [
    ...new Set(
      formData
        .getAll("project_ids")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
  const projectRole =
    String(formData.get("project_role") ?? "member") === "lead" ? "lead" : "member";

  if (projectIds.length > 0) {
    const { data: validProjects, error: projectError } = await ctx.supabase
      .from("projects")
      .select("id")
      .eq("organization_id", ctx.org.id)
      .in("id", projectIds);
    if (projectError) return { error: projectError.message };
    if ((validProjects ?? []).length !== projectIds.length) {
      return { error: "One or more projects were not found" };
    }
  }

  const { data: existingProjectRows, error: existingError } = await db
    .from("project_members")
    .select("project_id")
    .eq("organization_id", ctx.org.id)
    .eq("user_id", member.user_id);
  if (existingError) return { error: existingError.message };

  const existingIds = new Set(
    (existingProjectRows ?? []).map((row) => row.project_id as string),
  );
  const nextIds = new Set(projectIds);
  let toRemove = [...existingIds].filter((id) => !nextIds.has(id));
  if (!elevated && toRemove.length > 0) {
    const { data: visible } = await ctx.supabase
      .from("projects")
      .select("id")
      .eq("organization_id", ctx.org.id)
      .in("id", toRemove);
    const visibleIds = new Set((visible ?? []).map((row) => row.id as string));
    toRemove = toRemove.filter((id) => visibleIds.has(id));
  }

  if (toRemove.length > 0) {
    const { error: removeError } = await db
      .from("project_members")
      .delete()
      .eq("organization_id", ctx.org.id)
      .eq("user_id", member.user_id)
      .in("project_id", toRemove);
    if (removeError) return { error: removeError.message };
  }

  if (projectIds.length > 0) {
    const { error: upsertError } = await db.from("project_members").upsert(
      projectIds.map((projectId) => ({
        organization_id: ctx.org.id,
        project_id: projectId,
        user_id: member.user_id,
        role: projectRole,
      })),
      { onConflict: "project_id,user_id" },
    );
    if (upsertError) return { error: upsertError.message };
  }

  const roleChanged = member.role !== role;
  const accessChanged =
    roleChanged ||
    JSON.stringify(member.permissions ?? null) !== JSON.stringify(permissions);
  const addedProjects = projectIds.filter((id) => !existingIds.has(id)).length;
  if (accessChanged || addedProjects > 0) {
    const [actor, memberName] = await Promise.all([
      userLabel(ctx.userId),
      userLabel(member.user_id as string),
    ]);
    const details = [
      roleChanged
        ? `Your role is now ${roleLabel(role)}.`
        : accessChanged
          ? "Your module permissions were updated."
          : null,
      addedProjects > 0
        ? `You were added to ${addedProjects} project${addedProjects === 1 ? "" : "s"}.`
        : null,
    ].filter(Boolean);
    await notify({
      recipients: [member.user_id as string],
      organizationId: ctx.org.id,
      orgName: ctx.org.name,
      category: "team",
      title: `${actor} updated your access in ${ctx.org.name}`,
      body: details.join(" "),
      href: `/${orgSlug}`,
      actorId: ctx.userId,
      entity: { type: "member", id: memberId },
      actionLabel: "Open Worklane",
      ownerCopy: {
        title: `${actor} updated ${memberName}’s access`,
        body: [
          roleChanged ? `Role is now ${roleLabel(role)}.` : accessChanged ? "Module permissions changed." : null,
          addedProjects > 0
            ? `Added to ${addedProjects} project${addedProjects === 1 ? "" : "s"}.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });
  }

  revalidatePath(`/${orgSlug}/team`);
  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/projects`);
  for (const projectId of [...toRemove, ...projectIds]) {
    revalidatePath(`/${orgSlug}/projects/${projectId}`);
  }
  return { ok: true as const };
}

export async function resendInvitationAction(orgSlug: string, invitationId: string) {
  const gate = await requireTeamManager(orgSlug);
  if ("error" in gate) return { error: gate.error };
  const { ctx, db, elevated } = gate;

  const { data: invite, error: loadError } = await db
    .from("organization_invitations")
    .select("id, email, role, project_id, partner_id, accepted_at")
    .eq("id", invitationId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!invite) return { error: "Invite not found" };
  if (invite.accepted_at) return { error: "Invite already accepted" };
  if (!elevated && invite.role === "admin") {
    return { error: "Only owners and admins can resend admin invites" };
  }

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

  const { error: updateError } = await db
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

  const inviteInput = {
    orgName: ctx.org.name,
    inviterLabel: inviter,
    role,
    acceptUrl,
    projectName,
  };
  const mailed = await sendEmail({
    to: email,
    subject: projectName
      ? `Join ${projectName} on ${ctx.org.name}`
      : role === "partner"
        ? `Join ${ctx.org.name} as a partner`
        : `Join ${ctx.org.name} on Worklane`,
    html: inviteEmailHtml(inviteInput),
    text: inviteEmailText(inviteInput),
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
  category?: NotificationCategory;
  actorId?: string | null;
}) {
  await notify({
    recipients: [input.userId],
    organizationId: input.organizationId ?? null,
    category: input.category ?? "general",
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    actorId: input.actorId ?? null,
    email: input.sendMail === false ? false : undefined,
    ownerCopy: false,
  });
}

export async function removeMemberAction(orgSlug: string, memberId: string, confirmValue: string) {
  const gate = await requireTeamManager(orgSlug);
  if ("error" in gate) return { error: gate.error };
  const { ctx, db } = gate;

  const { data: member } = await db
    .from("organization_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!member) return { error: "Member not found" };
  if (member.role === "owner") return { error: "The owner can’t be removed" };
  if (member.user_id === ctx.userId) return { error: "You can’t remove yourself" };
  if (member.role === "admin" && ctx.role !== "owner") {
    return { error: "Only owners can remove admins" };
  }

  const { data: profile } = await db
    .from("profiles")
    .select("email, display_name")
    .eq("id", member.user_id)
    .maybeSingle();
  const expected = String(profile?.email || profile?.display_name || "").trim();
  if (!expected || confirmValue.trim().toLowerCase() !== expected.toLowerCase()) {
    return { error: "Confirmation doesn’t match" };
  }

  const { error: projectError } = await db
    .from("project_members")
    .delete()
    .eq("organization_id", ctx.org.id)
    .eq("user_id", member.user_id);
  if (projectError) return { error: projectError.message };

  const { error, count } = await db
    .from("organization_members")
    .delete({ count: "exact" })
    .eq("id", memberId)
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  if (!count) return { error: "You don’t have permission to remove this member" };

  revalidatePath(`/${orgSlug}/team`);
  revalidatePath(`/${orgSlug}/settings`);
  return { ok: true as const };
}
