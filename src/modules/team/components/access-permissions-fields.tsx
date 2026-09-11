"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/studio/field";
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

export type AccessPreset = "full" | "progress" | "partner" | "custom";

function clonePermissions(value: MemberPermissions): MemberPermissions {
  return structuredClone(value);
}

function samePermissions(a: MemberPermissions, b: MemberPermissions) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function inferAccessPreset(
  permissions: MemberPermissions | null | undefined,
  role?: string,
): AccessPreset {
  if (!permissions) {
    return role === "partner" ? "partner" : "full";
  }
  if (samePermissions(permissions, FULL_PERMISSIONS)) return "full";
  if (samePermissions(permissions, PROGRESS_ONLY_PERMISSIONS)) return "progress";
  if (samePermissions(permissions, PARTNER_DEFAULT_PERMISSIONS)) return "partner";
  return "custom";
}

export function useAccessPermissionsState(
  initial: MemberPermissions | null | undefined,
  initialRole?: string,
) {
  const seed = initial
    ? clonePermissions(initial)
    : clonePermissions(
        initialRole === "partner" ? PARTNER_DEFAULT_PERMISSIONS : FULL_PERMISSIONS,
      );
  const [preset, setPreset] = useState<AccessPreset>(() =>
    inferAccessPreset(initial, initialRole),
  );
  const [permissions, setPermissions] = useState<MemberPermissions>(seed);

  const shownPermissions = useMemo(() => {
    if (preset === "progress") return PROGRESS_ONLY_PERMISSIONS;
    if (preset === "partner") return PARTNER_DEFAULT_PERMISSIONS;
    if (preset === "full") return FULL_PERMISSIONS;
    return permissions;
  }, [preset, permissions]);

  function applyPreset(next: AccessPreset) {
    setPreset(next);
    if (next === "full") setPermissions(clonePermissions(FULL_PERMISSIONS));
    if (next === "progress") setPermissions(clonePermissions(PROGRESS_ONLY_PERMISSIONS));
    if (next === "partner") setPermissions(clonePermissions(PARTNER_DEFAULT_PERMISSIONS));
  }

  function setModuleAccess(module: keyof MemberPermissions, access: AccessLevel) {
    setPreset("custom");
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        access,
        tabs:
          module === "delivery"
            ? prev.delivery?.tabs ?? FULL_PERMISSIONS.delivery?.tabs
            : undefined,
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

  return {
    preset,
    shownPermissions,
    applyPreset,
    setModuleAccess,
    setTab,
  };
}

export function AccessPermissionsFields({
  preset,
  shownPermissions,
  onPresetChange,
  onModuleAccess,
  onTabToggle,
  idPrefix = "access",
}: {
  preset: AccessPreset;
  shownPermissions: MemberPermissions;
  onPresetChange: (preset: AccessPreset) => void;
  onModuleAccess: (module: keyof MemberPermissions, access: AccessLevel) => void;
  onTabToggle: (tab: ProjectTabKey, enabled: boolean) => void;
  idPrefix?: string;
}) {
  return (
    <>
      <Field label="Access" htmlFor={`${idPrefix}_preset`}>
        <NativeSelect
          id={`${idPrefix}_preset`}
          value={preset}
          onChange={(event) => onPresetChange(event.target.value as AccessPreset)}
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
                onModuleAccess(key, event.target.value as AccessLevel)
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
                  onChange={(event) => onTabToggle(tab, event.target.checked)}
                />
                {tab}
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
