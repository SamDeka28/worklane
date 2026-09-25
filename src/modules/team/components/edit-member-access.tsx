"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { MemberPermissions } from "@/modules/identity/permissions";
import type { OrgRole } from "@/modules/identity/types";
import { updateMemberAccessAction } from "@/modules/team/actions";
import {
  AccessPermissionsFields,
  presetNeedsWrite,
  useAccessPermissionsState,
} from "@/modules/team/components/access-permissions-fields";
import { ProjectMultiSelect } from "@/modules/team/components/project-multi-select";

export function EditMemberAccessSheet({
  orgSlug,
  member,
  actorRole,
  projects = [],
}: {
  orgSlug: string;
  member: {
    id: string;
    userId: string;
    role: OrgRole;
    email: string | null;
    displayName: string | null;
    permissions: MemberPermissions | null;
    isYou: boolean;
    projectIds?: string[];
    projectRole?: "member" | "lead" | null;
  };
  actorRole: OrgRole;
  projects?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [role, setRole] = useState(member.role === "owner" ? "admin" : member.role);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    member.projectIds ?? [],
  );
  const [projectRole, setProjectRole] = useState<"member" | "lead">(
    member.projectRole === "lead" ? "lead" : "member",
  );
  const access = useAccessPermissionsState(member.permissions, member.role);

  function promoteFromPartner() {
    if (role !== "partner") return;
    setRole("member");
    toast.info("Role changed to Member: partners can only view");
  }

  const label =
    member.displayName?.trim() || member.email || member.userId.slice(0, 8);
  const lockedOwner = member.role === "owner";
  const canEditAdmins = actorRole === "owner";

  if (lockedOwner) return null;

  return (
    <ActionSheet
      title="Edit access"
      description={`Change role, projects, and module access for ${label}.`}
      triggerLabel="Access"
      triggerVariant="outline"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelectedProjectIds(member.projectIds ?? []);
          setProjectRole(member.projectRole === "lead" ? "lead" : "member");
          setRole(member.role === "owner" ? "admin" : member.role);
          access.reset(member.permissions, member.role);
        }
      }}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          formData.set("role", role);
          formData.set("permissions_preset", access.preset);
          formData.set("permissions", JSON.stringify(access.shownPermissions));
          formData.set("project_role", projectRole);
          for (const pid of selectedProjectIds) {
            formData.append("project_ids", pid);
          }
          start(async () => {
            const result = await updateMemberAccessAction(orgSlug, member.id, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Access updated");
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field label="Studio role" htmlFor={`member_role_${member.id}`}>
          <NativeSelect
            id={`member_role_${member.id}`}
            value={role}
            onChange={(event) => {
              const next = event.target.value;
              setRole(next as typeof role);
              if (next === "partner") access.applyPreset("partner");
            }}
          >
            {canEditAdmins ? <option value="admin">Admin</option> : null}
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="partner">Partner</option>
          </NativeSelect>
        </Field>

        {projects.length > 0 ? (
          <div className="grid gap-3">
            <Field
              label="Projects"
              htmlFor={`member_projects_${member.id}`}
              hint="Studio access stays. Choose which projects they can open."
            >
              <ProjectMultiSelect
                id={`member_projects_${member.id}`}
                projects={projects}
                selectedIds={selectedProjectIds}
                onChange={setSelectedProjectIds}
              />
            </Field>
            {selectedProjectIds.length > 0 ? (
              <Field label="Project role" htmlFor={`member_project_role_${member.id}`}>
                <NativeSelect
                  id={`member_project_role_${member.id}`}
                  value={projectRole}
                  onChange={(event) =>
                    setProjectRole(event.target.value === "lead" ? "lead" : "member")
                  }
                >
                  <option value="member">Member</option>
                  <option value="lead">Lead</option>
                </NativeSelect>
              </Field>
            ) : null}
          </div>
        ) : null}

        <AccessPermissionsFields
          idPrefix={`member_${member.id}`}
          preset={access.preset}
          shownPermissions={access.shownPermissions}
          onPresetChange={(next) => {
            if (presetNeedsWrite(next)) promoteFromPartner();
            access.applyPreset(next);
          }}
          onModuleAccess={(module, level) => {
            if (level === "write") promoteFromPartner();
            access.setModuleAccess(module, level);
          }}
          onTabToggle={access.setTab}
        />

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save access"}
        </Button>
      </form>
    </ActionSheet>
  );
}
