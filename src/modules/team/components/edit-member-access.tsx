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
  useAccessPermissionsState,
} from "@/modules/team/components/access-permissions-fields";

export function EditMemberAccessSheet({
  orgSlug,
  member,
  actorRole,
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
  };
  actorRole: OrgRole;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [role, setRole] = useState(member.role === "owner" ? "admin" : member.role);
  const access = useAccessPermissionsState(member.permissions, member.role);

  const label =
    member.displayName?.trim() || member.email || member.userId.slice(0, 8);
  const lockedOwner = member.role === "owner";
  const canEditAdmins = actorRole === "owner";

  if (lockedOwner) return null;

  return (
    <ActionSheet
      title="Edit access"
      description={`Change role and module access for ${label}.`}
      triggerLabel="Access"
      triggerVariant="outline"
      open={open}
      onOpenChange={setOpen}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          formData.set("role", role);
          formData.set("permissions_preset", access.preset);
          formData.set("permissions", JSON.stringify(access.shownPermissions));
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

        <AccessPermissionsFields
          idPrefix={`member_${member.id}`}
          preset={
            role === "partner" && access.preset === "full" ? "partner" : access.preset
          }
          shownPermissions={access.shownPermissions}
          onPresetChange={access.applyPreset}
          onModuleAccess={access.setModuleAccess}
          onTabToggle={access.setTab}
        />

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save access"}
        </Button>
      </form>
    </ActionSheet>
  );
}
