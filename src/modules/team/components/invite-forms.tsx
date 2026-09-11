"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusChip } from "@/components/studio/status-chip";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  FULL_PERMISSIONS,
  PARTNER_DEFAULT_PERMISSIONS,
  PROGRESS_ONLY_PERMISSIONS,
  PROJECT_TAB_KEYS,
  type AccessLevel,
  type MemberPermissions,
  type ProjectTabKey,
} from "@/modules/identity/permissions";
import {
  inviteOrgMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
} from "@/modules/team/actions";
import { invitePartnerLoginAction } from "@/modules/partners/actions";
import type { OrgInvitation } from "@/modules/team/types";

function clonePermissions(value: MemberPermissions): MemberPermissions {
  return structuredClone(value);
}

export function InviteMemberForm({
  orgSlug,
  projects = [],
  defaultProjectId,
  compact = false,
}: {
  orgSlug: string;
  projects?: { id: string; name: string }[];
  defaultProjectId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [role, setRole] = useState("member");
  const [preset, setPreset] = useState<"full" | "progress" | "partner" | "custom">("full");
  const [permissions, setPermissions] = useState<MemberPermissions>(() =>
    clonePermissions(FULL_PERMISSIONS),
  );

  const effectivePreset = role === "partner" && preset === "full" ? "partner" : preset;

  const shownPermissions = useMemo(() => {
    if (effectivePreset === "progress") return PROGRESS_ONLY_PERMISSIONS;
    if (effectivePreset === "partner") return PARTNER_DEFAULT_PERMISSIONS;
    if (effectivePreset === "full") return FULL_PERMISSIONS;
    return permissions;
  }, [effectivePreset, permissions]);

  function setModuleAccess(module: keyof MemberPermissions, access: AccessLevel) {
    setPreset("custom");
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        access,
        tabs: module === "delivery" ? prev.delivery?.tabs ?? FULL_PERMISSIONS.delivery?.tabs : undefined,
      },
    }));
  }

  function setTab(tab: ProjectTabKey, enabled: boolean) {
    setPreset("custom");
    setPermissions((prev) => ({
      ...prev,
      delivery: {
        access: prev.delivery?.access ?? "write",
        tabs: {
          ...(prev.delivery?.tabs ?? FULL_PERMISSIONS.delivery?.tabs),
          [tab]: enabled,
        },
      },
    }));
  }

  return (
    <form
      className={compact ? "grid gap-3" : "grid gap-3"}
      action={(formData) => {
        formData.set("permissions_preset", effectivePreset);
        formData.set("permissions", JSON.stringify(shownPermissions));
        start(async () => {
          const result = await inviteOrgMemberAction(orgSlug, formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (result.alreadyMember) {
            toast.success("Already a member — added to project");
          } else if (result.emailed) {
            toast.success("Invite emailed");
          } else if (result.acceptUrl) {
            toast.success("Invite created (email not configured)");
            try {
              await navigator.clipboard.writeText(result.acceptUrl);
              toast.message("Invite link copied");
            } catch {
              /* ignore */
            }
          } else {
            toast.success("Invite sent");
          }
          router.refresh();
        });
      }}
    >
      <Field label="Email" htmlFor="invite_email" required>
        <Input
          id="invite_email"
          name="email"
          type="email"
          required
          placeholder="teammate@studio.com"
        />
      </Field>
      <div className={`grid gap-3 ${projects.length > 0 ? "sm:grid-cols-2" : ""}`}>
        <Field label="Studio role" htmlFor="invite_role">
          <NativeSelect
            id="invite_role"
            name="role"
            value={role}
            onChange={(event) => {
              const next = event.target.value;
              setRole(next);
              if (next === "partner") {
                setPreset("partner");
                setPermissions(clonePermissions(PARTNER_DEFAULT_PERMISSIONS));
              }
            }}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="partner">Partner</option>
          </NativeSelect>
        </Field>
        {projects.length > 0 ? (
          <Field label="Also add to project" htmlFor="invite_project">
            <NativeSelect
              id="invite_project"
              name="project_id"
              defaultValue={defaultProjectId ?? ""}
            >
              <option value="">Studio only</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : defaultProjectId ? (
          <input type="hidden" name="project_id" value={defaultProjectId} />
        ) : null}
      </div>
      {defaultProjectId || projects.length > 0 ? (
        <Field label="Project role" htmlFor="invite_project_role">
          <NativeSelect id="invite_project_role" name="project_role" defaultValue="member">
            <option value="member">Member</option>
            <option value="lead">Lead</option>
          </NativeSelect>
        </Field>
      ) : null}

      <Field label="Access" htmlFor="invite_access_preset">
        <NativeSelect
          id="invite_access_preset"
          value={effectivePreset}
          onChange={(event) => {
            const next = event.target.value as typeof preset;
            setPreset(next);
            if (next === "full") setPermissions(clonePermissions(FULL_PERMISSIONS));
            if (next === "progress") setPermissions(clonePermissions(PROGRESS_ONLY_PERMISSIONS));
            if (next === "partner") setPermissions(clonePermissions(PARTNER_DEFAULT_PERMISSIONS));
          }}
        >
          <option value="full">Full access</option>
          <option value="progress">Progress only</option>
          <option value="partner">Partner default</option>
          <option value="custom">Custom</option>
        </NativeSelect>
      </Field>

      <div className="grid gap-2 rounded-2xl bg-muted/40 p-3 ring-1 ring-border/30">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Modules
        </p>
        {(
          [
            ["delivery", "Projects"],
            ["finance", "Finance"],
            ["partners", "Partners"],
            ["crm", "Leads"],
            ["documents", "Documents"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3 text-sm">
            <span>{label}</span>
            <NativeSelect
              className="h-8 w-28"
              value={shownPermissions[key]?.access ?? "none"}
              onChange={(event) =>
                setModuleAccess(key, event.target.value as AccessLevel)
              }
            >
              <option value="none">Hidden</option>
              <option value="read">View</option>
              <option value="write">Edit</option>
            </NativeSelect>
          </label>
        ))}
        {(shownPermissions.delivery?.access ?? "none") !== "none" ? (
          <div className="mt-2 grid gap-1.5 border-t border-border/40 pt-2">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Project tabs
            </p>
            {PROJECT_TAB_KEYS.map((tab) => (
              <label key={tab} className="flex items-center gap-2 text-sm capitalize">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-border"
                  checked={shownPermissions.delivery?.tabs?.[tab] !== false}
                  onChange={(event) => setTab(tab, event.target.checked)}
                />
                {tab}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}

function inviteStatus(invite: OrgInvitation): "pending" | "expired" {
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return "expired";
  }
  return "pending";
}


function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) return null;
  try {
    return new Date(expiresAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function PendingInvitesList({
  orgSlug,
  invitations,
}: {
  orgSlug: string;
  invitations: OrgInvitation[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending invites</p>;
  }

  return (
    <ul className="space-y-2">
      {invitations.map((invite) => {
        const status = inviteStatus(invite);
        const expiryLabel = formatExpiry(invite.expiresAt);
        return (
          <li
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/40 px-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{invite.email}</p>
                <StatusChip tone={status === "expired" ? "overdue" : "planning"}>
                  {status === "expired" ? "Expired" : "Pending"}
                </StatusChip>
              </div>
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                {invite.role}
                {invite.projectId ? " · project access" : ""}
                {invite.partnerId ? " · partner profile" : ""}
                {expiryLabel
                  ? status === "expired"
                    ? ` · expired ${expiryLabel}`
                    : ` · expires ${expiryLabel}`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await resendInvitationAction(orgSlug, invite.id);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    if (result.emailed) {
                      toast.success("Invite resent");
                    } else if (result.acceptUrl) {
                      toast.success("Invite renewed (email not configured)");
                      try {
                        await navigator.clipboard.writeText(result.acceptUrl);
                        toast.message("Invite link copied");
                      } catch {
                        /* ignore */
                      }
                    } else {
                      toast.success("Invite resent");
                    }
                    router.refresh();
                  });
                }}
              >
                Resend
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await revokeInvitationAction(orgSlug, invite.id);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success("Invite revoked");
                      router.refresh();
                    }
                  });
                }}
              >
                Revoke
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function toastInviteResult(result: {
  emailed?: boolean;
  acceptUrl?: string;
  alreadyMember?: boolean;
  successLabel?: string;
}) {
  if (result.alreadyMember) {
    toast.success("Already a member — linked");
    return;
  }
  if (result.emailed) {
    toast.success(result.successLabel ?? "Invite sent");
    return;
  }
  if (result.acceptUrl) {
    toast.success("Invite created (email not configured)");
    void navigator.clipboard.writeText(result.acceptUrl).then(
      () => toast.message("Invite link copied"),
      () => undefined,
    );
    return;
  }
  toast.success(result.successLabel ?? "Invite sent");
}

export function ResendInviteButton({
  orgSlug,
  invitationId,
  label = "Resend invite",
  variant = "outline",
  className,
}: {
  orgSlug: string;
  invitationId: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={className}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        start(async () => {
          const result = await resendInvitationAction(orgSlug, invitationId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toastInviteResult({ ...result, successLabel: "Invite resent" });
          router.refresh();
        });
      }}
    >
      {pending ? "Sending…" : label}
    </Button>
  );
}

export function RevokeInviteButton({
  orgSlug,
  invitationId,
  label = "Revoke",
  className,
}: {
  orgSlug: string;
  invitationId: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={className}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        start(async () => {
          const result = await revokeInvitationAction(orgSlug, invitationId);
          if (result.error) toast.error(result.error);
          else {
            toast.success("Invite revoked");
            router.refresh();
          }
        });
      }}
    >
      {pending ? "…" : label}
    </Button>
  );
}

export function InvitePartnerLoginButton({
  orgSlug,
  partnerId,
  label = "Invite",
  variant = "outline",
  className,
}: {
  orgSlug: string;
  partnerId: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      className={className}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        start(async () => {
          const result = await invitePartnerLoginAction(orgSlug, partnerId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toastInviteResult(result);
          router.refresh();
        });
      }}
    >
      {pending ? "Sending…" : label}
    </Button>
  );
}
