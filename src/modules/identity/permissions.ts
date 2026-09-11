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
  tabs?: Partial<Record<ProjectTabKey, boolean>>;
};

export type MemberPermissions = Partial<Record<ModuleKey, ModulePermission>>;

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
  return raw as MemberPermissions;
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
  for (const key of Object.keys(base) as ModuleKey[]) {
    const mod = base[key];
    if (!mod) continue;
    if (!input.orgModules[key] && key !== "portal") {
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

export function canAccessProjectTab(
  permissions: MemberPermissions,
  tab: ProjectTabKey,
): boolean {
  if (!canAccessModule(permissions, "delivery")) return false;
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
