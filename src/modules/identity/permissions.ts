import type { ModuleKey } from "@/modules/identity/types";

export type AccessLevel = "none" | "read" | "write";

export type ProjectTabKey =
  | "overview"
  | "milestones"
  | "work"
  | "documents"
  | "charges"
  | "split";

export type ModulePermission = {
  access: AccessLevel;
  /** Permanent delete; only honoured with `write` access. Never implied by presets. */
  delete?: boolean;
  tabs?: Partial<Record<ProjectTabKey, boolean>>;
};

/** Modules with permanent-delete actions. `crm` covers leads and clients. */
export const DELETABLE_MODULES = ["delivery", "crm", "partners"] as const;
export type DeletableModule = (typeof DELETABLE_MODULES)[number];

export function isDeletableModule(module: ModuleKey): module is DeletableModule {
  return (DELETABLE_MODULES as readonly string[]).includes(module);
}

/** Owners and admins can always delete; others need write + the module's delete flag. */
export function canDeleteModule(
  input: { role: string; permissions: MemberPermissions },
  module: DeletableModule,
): boolean {
  if (input.role === "owner" || input.role === "admin") return true;
  if (input.role !== "member") return false;
  const mod = input.permissions[module];
  return mod?.access === "write" && mod.delete === true;
}

/** `team` is not an org module: `write` lets a member invite people and change access. */
export type PermissionKey = ModuleKey | "team";

export type MemberPermissions = Partial<Record<PermissionKey, ModulePermission>>;

/** Owners and admins always; members with `team: write`. Partners and viewers never. */
export function canManageTeam(input: { role: string; permissions: MemberPermissions }): boolean {
  if (input.role === "owner" || input.role === "admin") return true;
  return input.role === "member" && input.permissions.team?.access === "write";
}

const ACCESS_RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };

const GRANT_LABELS: Record<PermissionKey, string> = {
  delivery: "Projects",
  finance: "Finance",
  partners: "Partners",
  crm: "Leads",
  documents: "Documents",
  portal: "Portal",
  team: "Team",
};

/**
 * A non-admin team manager can only hand out access they hold themselves.
 * Returns a human-readable reason when `target` exceeds `limit`, else null.
 */
export function grantViolation(
  target: MemberPermissions,
  limit: MemberPermissions,
): string | null {
  for (const key of Object.keys(target) as PermissionKey[]) {
    const want = target[key];
    if (!want) continue;
    const have = limit[key];
    const label = GRANT_LABELS[key] ?? key;
    if (ACCESS_RANK[want.access] > ACCESS_RANK[have?.access ?? "none"]) {
      return `You can’t grant ${label} ${want.access === "write" ? "edit" : "view"} access you don’t have`;
    }
    if (want.delete && !(have?.access === "write" && have.delete)) {
      return `You can’t grant ${label} delete access you don’t have`;
    }
    if (key === "delivery" && want.access !== "none") {
      for (const tab of PROJECT_TAB_KEYS) {
        const wantTab = want.tabs?.[tab] !== false;
        const haveTab = have?.tabs?.[tab] !== false;
        if (wantTab && !haveTab) return `You can’t grant the ${tab} project tab`;
      }
    }
  }
  return null;
}

export const PROJECT_TAB_KEYS: ProjectTabKey[] = [
  "overview",
  "milestones",
  "work",
  "documents",
  "charges",
  "split",
];

export const FULL_PERMISSIONS: MemberPermissions = {
  crm: { access: "write" },
  documents: { access: "write" },
  delivery: {
    access: "write",
    tabs: {
      overview: true,
      milestones: true,
      work: true,
      documents: true,
      charges: true,
      split: true,
    },
  },
  finance: { access: "write" },
  partners: { access: "write" },
  portal: { access: "none" },
};

export const PROGRESS_ONLY_PERMISSIONS: MemberPermissions = {
  crm: { access: "none" },
  documents: { access: "read" },
  delivery: {
    access: "write",
    tabs: {
      overview: true,
      milestones: true,
      work: true,
      documents: true,
      charges: false,
      split: false,
    },
  },
  finance: { access: "none" },
  partners: { access: "none" },
  portal: { access: "none" },
};

export const PARTNER_DEFAULT_PERMISSIONS: MemberPermissions = {
  crm: { access: "none" },
  documents: { access: "read" },
  delivery: {
    access: "read",
    tabs: {
      overview: true,
      milestones: true,
      work: true,
      documents: true,
      charges: false,
      split: false,
    },
  },
  finance: { access: "none" },
  partners: { access: "read" },
  portal: { access: "none" },
};

export function permissionsPreset(
  preset: "full" | "progress" | "partner" | "custom",
  custom?: MemberPermissions | null,
): MemberPermissions {
  if (preset === "progress") return structuredClone(PROGRESS_ONLY_PERMISSIONS);
  if (preset === "partner") return structuredClone(PARTNER_DEFAULT_PERMISSIONS);
  if (preset === "custom" && custom) return structuredClone(custom);
  return structuredClone(FULL_PERMISSIONS);
}

export function parseMemberPermissions(raw: unknown): MemberPermissions | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as MemberPermissions;
  const cleaned: MemberPermissions = {};
  for (const key of Object.keys(parsed) as PermissionKey[]) {
    const mod = parsed[key];
    if (!mod) continue;
    const allowDelete =
      key !== "team" && isDeletableModule(key) && mod.access === "write" && mod.delete === true;
    cleaned[key] = { ...mod, delete: allowDelete ? true : undefined };
  }
  return cleaned;
}

/** Partner and viewer roles can't write (RLS `can_write_org`), so cap every module at read. */
export function readOnlyPermissions(permissions: MemberPermissions): MemberPermissions {
  const capped: MemberPermissions = {};
  for (const key of Object.keys(permissions) as PermissionKey[]) {
    const mod = permissions[key];
    if (!mod) continue;
    capped[key] = {
      ...mod,
      access: mod.access === "write" ? "read" : mod.access,
      delete: undefined,
    };
  }
  return capped;
}

/** Resolve effective permissions: null/empty jsonb → full staff; intersect with org modules. */
export function resolveMemberPermissions(input: {
  role: string;
  stored: MemberPermissions | null;
  orgModules: Record<ModuleKey, boolean>;
}): MemberPermissions {
  const base =
    input.stored ??
    (input.role === "partner"
      ? PARTNER_DEFAULT_PERMISSIONS
      : input.role === "viewer"
        ? {
            ...FULL_PERMISSIONS,
            crm: { access: "read" as const },
            documents: { access: "read" as const },
            delivery: {
              access: "read" as const,
              tabs: FULL_PERMISSIONS.delivery?.tabs,
            },
            finance: { access: "read" as const },
            partners: { access: "read" as const },
          }
        : FULL_PERMISSIONS);

  const resolved: MemberPermissions = {};
  for (const key of Object.keys(base) as PermissionKey[]) {
    const mod = base[key];
    if (!mod) continue;
    if (key !== "team" && key !== "portal" && !input.orgModules[key]) {
      resolved[key] = { ...mod, access: "none" };
      continue;
    }
    resolved[key] = structuredClone(mod);
  }
  return resolved;
}

export function moduleAccess(
  permissions: MemberPermissions,
  module: ModuleKey,
): AccessLevel {
  return permissions[module]?.access ?? "none";
}

export function canAccessModule(
  permissions: MemberPermissions,
  module: ModuleKey,
): boolean {
  return moduleAccess(permissions, module) !== "none";
}

export function canWriteModule(
  permissions: MemberPermissions,
  module: ModuleKey,
): boolean {
  return moduleAccess(permissions, module) === "write";
}

/** Studio money (charges, due, totals, invoices, estimates). */
export function canSeeMoney(permissions: MemberPermissions): boolean {
  return canAccessModule(permissions, "finance");
}

export function canAccessProjectTab(
  permissions: MemberPermissions,
  tab: ProjectTabKey,
): boolean {
  if (!canAccessModule(permissions, "delivery")) return false;
  if (
    (tab === "charges" || tab === "split") &&
    !canAccessModule(permissions, "finance")
  ) {
    return false;
  }
  const tabs = permissions.delivery?.tabs;
  if (!tabs) return true;
  return tabs[tab] !== false;
}

export function firstAllowedProjectTab(
  permissions: MemberPermissions,
): ProjectTabKey {
  for (const tab of PROJECT_TAB_KEYS) {
    if (canAccessProjectTab(permissions, tab)) return tab;
  }
  return "overview";
}
