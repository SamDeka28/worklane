"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FULL_PERMISSIONS,
  PARTNER_DEFAULT_PERMISSIONS,
  PROGRESS_ONLY_PERMISSIONS,
  PROJECT_TAB_KEYS,
  grantViolation,
  isDeletableModule,
  type AccessLevel,
  type MemberPermissions,
  type ProjectTabKey,
} from "@/modules/identity/permissions";

export type AccessPreset = "full" | "progress" | "partner" | "custom";

const MODULE_ROWS = [
  ["delivery", "Projects"],
  ["finance", "Finance"],
  ["partners", "Partners"],
  ["crm", "Leads"],
  ["documents", "Documents"],
] as const;

const PRESET_OPTIONS: {
  id: AccessPreset;
  title: string;
  hint: string;
}[] = [
  { id: "full", title: "Full", hint: "Edit everything" },
  { id: "progress", title: "Progress", hint: "Projects & docs" },
  { id: "partner", title: "Partner", hint: "Read delivery" },
  { id: "custom", title: "Custom", hint: "Pick modules" },
];

const ACCESS_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: "none", label: "Off" },
  { value: "read", label: "View" },
  { value: "write", label: "Edit" },
];

const TAB_LABELS: Record<ProjectTabKey, string> = {
  overview: "Overview",
  milestones: "Milestones",
  work: "Work",
  documents: "Documents",
  charges: "Charges",
  split: "Split",
  credentials: "Credentials",
};

function clonePermissions(value: MemberPermissions): MemberPermissions {
  return structuredClone(value);
}

function withoutTeam(value: MemberPermissions): MemberPermissions {
  const rest = { ...value };
  delete rest.team;
  return rest;
}

function samePermissions(a: MemberPermissions, b: MemberPermissions) {
  return JSON.stringify(withoutTeam(a)) === JSON.stringify(withoutTeam(b));
}

const ACCESS_RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };

const PRESET_PERMISSIONS: Partial<Record<AccessPreset, MemberPermissions>> = {
  full: FULL_PERMISSIONS,
  progress: PROGRESS_ONLY_PERMISSIONS,
  partner: PARTNER_DEFAULT_PERMISSIONS,
};

function accessWord(level: AccessLevel | undefined) {
  if (level === "write") return "Edit";
  if (level === "read") return "View";
  return "Off";
}

function summarizePermissions(permissions: MemberPermissions) {
  const parts = MODULE_ROWS.filter(
    ([key]) => (permissions[key]?.access ?? "none") !== "none",
  ).map(([key, label]) => `${label} ${accessWord(permissions[key]?.access).toLowerCase()}`);
  if (parts.length === 0) return "No modules visible";
  return parts.join(" · ");
}

/** Presets that include edit access, which the partner role can't hold (it's read-only in RLS). */
export function presetNeedsWrite(preset: AccessPreset) {
  return preset === "full" || preset === "progress";
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
  const [manageTeam, setManageTeam] = useState(initial?.team?.access === "write");

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
        delete: access === "write" ? prev[module]?.delete : undefined,
        tabs:
          module === "delivery"
            ? prev.delivery?.tabs ?? FULL_PERMISSIONS.delivery?.tabs
            : undefined,
      },
    }));
  }

  function setModuleDelete(module: keyof MemberPermissions, enabled: boolean) {
    setPreset("custom");
    setPermissions((prev) => {
      const current = prev[module];
      if (current?.access !== "write") return prev;
      return { ...prev, [module]: { ...current, delete: enabled || undefined } };
    });
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

  function reset(next: MemberPermissions | null | undefined, role?: string) {
    setManageTeam(next?.team?.access === "write");
    setPreset(inferAccessPreset(next, role));
    setPermissions(
      next
        ? clonePermissions(next)
        : clonePermissions(role === "partner" ? PARTNER_DEFAULT_PERMISSIONS : FULL_PERMISSIONS),
    );
  }

  return {
    preset,
    shownPermissions,
    reset,
    applyPreset,
    setModuleAccess,
    setModuleDelete,
    setTab,
    manageTeam,
    setManageTeam,
  };
}

function AccessSegment({
  value,
  onChange,
  name,
  max = "write",
}: {
  value: AccessLevel;
  onChange: (next: AccessLevel) => void;
  name: string;
  /** Highest level the current user may grant. */
  max?: AccessLevel;
}) {
  return (
    <div
      className="inline-flex rounded-xl bg-inset p-0.5 ring-1 ring-foreground/10"
      role="radiogroup"
      aria-label={name}
    >
      {ACCESS_OPTIONS.map((option) => {
        const active = value === option.value;
        const locked = ACCESS_RANK[option.value] > ACCESS_RANK[max];
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={locked}
            title={locked ? "You can’t grant more than your own access" : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-[3.25rem] rounded-[0.625rem] px-2.5 py-1.5 text-xs font-semibold tracking-tight transition-[background-color,color,box-shadow]",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              locked && "cursor-not-allowed opacity-35 hover:text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const DELETE_HINTS: Partial<Record<keyof MemberPermissions, string>> = {
  delivery: "Can permanently delete projects",
  crm: "Can permanently delete leads and clients",
  partners: "Can permanently delete partners",
};

function DeleteToggle({
  label,
  hint,
  canWrite,
  locked = false,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  canWrite: boolean;
  locked?: boolean;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  const disabled = !canWrite || locked;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label}: allow delete`}
      title={
        locked
          ? "You can’t grant delete you don’t have"
          : canWrite
            ? hint
            : "Set to Edit to allow delete"
      }
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "w-[3.75rem] rounded-xl px-2 py-1.5 text-xs font-semibold tracking-tight ring-1 transition-[background-color,color,box-shadow]",
        on
          ? "bg-destructive/20 text-destructive ring-destructive/40"
          : "text-muted-foreground ring-foreground/10 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-35 hover:text-muted-foreground",
      )}
    >
      Delete
    </button>
  );
}

export function AccessPermissionsFields({
  preset,
  shownPermissions,
  onPresetChange,
  onModuleAccess,
  onModuleDelete,
  onTabToggle,
  grantLimit,
  manageTeam,
  onManageTeamChange,
}: {
  preset: AccessPreset;
  shownPermissions: MemberPermissions;
  onPresetChange: (preset: AccessPreset) => void;
  onModuleAccess: (module: keyof MemberPermissions, access: AccessLevel) => void;
  onModuleDelete: (module: keyof MemberPermissions, enabled: boolean) => void;
  onTabToggle: (tab: ProjectTabKey, enabled: boolean) => void;
  idPrefix?: string;
  /** When set (non-admin team managers), options above these permissions are locked. */
  grantLimit?: MemberPermissions;
  /** Shown only when the role can hold it (members). */
  manageTeam?: boolean;
  onManageTeamChange?: (next: boolean) => void;
}) {
  const deliveryOn = (shownPermissions.delivery?.access ?? "none") !== "none";
  const custom = preset === "custom";

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold tracking-tight text-foreground">Access</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESET_OPTIONS.map((option) => {
            const active = preset === option.id;
            const presetPermissions = PRESET_PERMISSIONS[option.id];
            const locked = Boolean(
              grantLimit && presetPermissions && grantViolation(presetPermissions, grantLimit),
            );
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                disabled={locked}
                title={locked ? "Includes access you don’t have" : undefined}
                onClick={() => onPresetChange(option.id)}
                className={cn(
                  "rounded-2xl px-3 py-2.5 text-left transition-colors ring-1",
                  active
                    ? "bg-primary/12 text-foreground ring-primary/35"
                    : "bg-muted/50 text-muted-foreground ring-transparent hover:bg-muted hover:text-foreground",
                  locked && "cursor-not-allowed opacity-40 hover:bg-muted/50",
                )}
              >
                <span className="block text-sm font-medium tracking-tight text-foreground">
                  {option.title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!custom ? (
        <p className="rounded-2xl bg-muted/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {summarizePermissions(shownPermissions)}
          <button
            type="button"
            className="ml-1.5 font-medium text-foreground underline-offset-2 hover:underline"
            onClick={() => onPresetChange("custom")}
          >
            Customize
          </button>
        </p>
      ) : (
        <div className="grid gap-3 rounded-2xl bg-muted/35 p-3 ring-1 ring-border/25">
          <div className="grid gap-2.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Modules
            </p>
            {MODULE_ROWS.map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm font-medium">{label}</span>
                <div className="flex items-center gap-1.5">
                  <AccessSegment
                    name={label}
                    value={shownPermissions[key]?.access ?? "none"}
                    onChange={(next) => onModuleAccess(key, next)}
                    max={grantLimit ? (grantLimit[key]?.access ?? "none") : "write"}
                  />
                  {isDeletableModule(key) ? (
                    <DeleteToggle
                      label={label}
                      hint={DELETE_HINTS[key]}
                      canWrite={shownPermissions[key]?.access === "write"}
                      locked={
                        Boolean(grantLimit) &&
                        !(grantLimit?.[key]?.access === "write" && grantLimit[key]?.delete)
                      }
                      on={
                        shownPermissions[key]?.access === "write" &&
                        shownPermissions[key]?.delete === true
                      }
                      onChange={(next) => onModuleDelete(key, next)}
                    />
                  ) : (
                    <span aria-hidden className="w-[3.75rem]" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {deliveryOn ? (
            <div className="grid gap-2 border-t border-border/35 pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Project tabs
                </p>
                <p className="text-[11px] text-muted-foreground">Visible in projects</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_TAB_KEYS.map((tab) => {
                  const on = shownPermissions.delivery?.tabs?.[tab] !== false;
                  const locked =
                    Boolean(grantLimit) && !on && grantLimit?.delivery?.tabs?.[tab] === false;
                  return (
                    <button
                      key={tab}
                      type="button"
                      aria-pressed={on}
                      disabled={locked}
                      onClick={() => onTabToggle(tab, !on)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                        on
                          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                          : "bg-background/70 text-muted-foreground ring-1 ring-border/40 hover:text-foreground",
                        locked && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {onManageTeamChange ? (
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(manageTeam)}
          onClick={() => onManageTeamChange(!manageTeam)}
          className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2.5 text-left ring-1 ring-border/25 transition-colors hover:bg-muted/55"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium tracking-tight">Manage team</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
              Invite people and change access, up to their own level
            </span>
          </span>
          <span
            aria-hidden
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
              manageTeam ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                manageTeam ? "translate-x-4.5" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
      ) : null}
    </div>
  );
}
