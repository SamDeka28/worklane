"use client";

import { Ban, Check, ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusChip } from "@/components/studio/status-chip";
import { Field } from "@/components/studio/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  inviteOrgMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
} from "@/modules/team/actions";
import { invitePartnerLoginAction } from "@/modules/partners/actions";
import type { OrgInvitation } from "@/modules/team/types";
import {
  AccessPermissionsFields,
  useAccessPermissionsState,
} from "@/modules/team/components/access-permissions-fields";

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
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    defaultProjectId ? [defaultProjectId] : [],
  );
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const access = useAccessPermissionsState(null, "member");

  const effectivePreset =
    role === "partner" && access.preset === "full" ? "partner" : access.preset;
  const showProjectRole =
    selectedProjectIds.length > 0 || Boolean(defaultProjectId && projects.length === 0);

  const selectedProjects = useMemo(
    () => projects.filter((project) => selectedProjectIds.includes(project.id)),
    [projects, selectedProjectIds],
  );

  function toggleProject(id: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  }

  function removeProject(id: string) {
    setSelectedProjectIds((prev) => prev.filter((pid) => pid !== id));
  }

  return (
    <form
      className={compact ? "grid gap-3.5" : "grid gap-3.5"}
      action={(formData) => {
        formData.set("permissions_preset", effectivePreset);
        formData.set("permissions", JSON.stringify(access.shownPermissions));
        for (const pid of selectedProjectIds) {
          formData.append("project_ids", pid);
        }
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

      <Field label="Studio role" htmlFor="invite_role">
        <NativeSelect
          id="invite_role"
          name="role"
          value={role}
          onChange={(event) => {
            const next = event.target.value;
            setRole(next);
            if (next === "partner") access.applyPreset("partner");
            else if (access.preset === "partner") access.applyPreset("full");
          }}
        >
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
          <option value="partner">Partner</option>
        </NativeSelect>
      </Field>

      {projects.length > 0 ? (
        <div className="grid gap-3">
          <Field
            label="Add to projects"
            htmlFor="invite_projects"
            hint="Studio access is always included. Pick projects from the menu."
          >
            <Popover open={projectMenuOpen} onOpenChange={setProjectMenuOpen}>
              <PopoverTrigger
                render={
                  <button
                    id="invite_projects"
                    type="button"
                    className={cn(
                      "relative inline-flex h-10 w-full min-w-0 items-center rounded-lg bg-muted/60 px-3 text-left text-sm font-medium tracking-tight ring-1 ring-border/40",
                      "transition-[box-shadow,background-color,ring-color] hover:bg-muted/80",
                      "focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none",
                    )}
                  />
                }
              >
                <span className="min-w-0 flex-1 truncate pr-8 text-foreground">
                  {selectedProjectIds.length === 0
                    ? "Studio only"
                    : `${selectedProjectIds.length} project${selectedProjectIds.length === 1 ? "" : "s"} selected`}
                </span>
                <ChevronDown
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--anchor-width) min-w-72 p-1.5">
                <ul className="max-h-56 overflow-y-auto">
                  <li>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                        selectedProjectIds.length === 0
                          ? "bg-primary/12 font-semibold text-primary"
                          : "text-foreground hover:bg-muted",
                      )}
                      onClick={() => setSelectedProjectIds([])}
                    >
                      <span className="min-w-0 flex-1 truncate">Studio only</span>
                      {selectedProjectIds.length === 0 ? (
                        <Check className="size-3.5 shrink-0" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                  {projects.map((project) => {
                    const active = selectedProjectIds.includes(project.id);
                    return (
                      <li key={project.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                            active
                              ? "bg-primary/12 font-semibold text-primary"
                              : "text-foreground hover:bg-muted",
                          )}
                          onClick={() => toggleProject(project.id)}
                        >
                          <span className="min-w-0 flex-1 truncate">{project.name}</span>
                          {active ? (
                            <Check className="size-3.5 shrink-0" aria-hidden />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            </Popover>

            {selectedProjects.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedProjects.map((project) => (
                  <Badge
                    key={project.id}
                    variant="secondary"
                    className="h-7 gap-1 rounded-full pr-1 pl-2.5"
                  >
                    <span className="max-w-40 truncate">{project.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${project.name}`}
                      className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                      onClick={() => removeProject(project.id)}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </Field>
          {showProjectRole ? (
            <Field label="Project role" htmlFor="invite_project_role">
              <NativeSelect
                id="invite_project_role"
                name="project_role"
                defaultValue="member"
              >
                <option value="member">Member</option>
                <option value="lead">Lead</option>
              </NativeSelect>
            </Field>
          ) : null}
        </div>
      ) : defaultProjectId ? (
        <>
          <input type="hidden" name="project_ids" value={defaultProjectId} />
          <Field label="Project role" htmlFor="invite_project_role">
            <NativeSelect
              id="invite_project_role"
              name="project_role"
              defaultValue="member"
            >
              <option value="member">Member</option>
              <option value="lead">Lead</option>
            </NativeSelect>
          </Field>
        </>
      ) : null}

      <AccessPermissionsFields
        preset={effectivePreset}
        shownPermissions={access.shownPermissions}
        onPresetChange={access.applyPreset}
        onModuleAccess={access.setModuleAccess}
        onTabToggle={access.setTab}
      />

      <Button type="submit" disabled={pending} className="w-full">
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
                {invite.projectIds?.length
                  ? ` · ${invite.projectIds.length} project${invite.projectIds.length === 1 ? "" : "s"}`
                  : invite.projectId
                    ? " · project access"
                    : ""}
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
  iconOnly = false,
}: {
  orgSlug: string;
  invitationId: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size={iconOnly ? "icon-sm" : "sm"}
      variant="outline"
      className={className}
      disabled={pending}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
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
      {iconOnly ? (
        pending ? (
          <span className="text-xs">…</span>
        ) : (
          <Ban className="size-3.5" />
        )
      ) : pending ? (
        "…"
      ) : (
        label
      )}
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
