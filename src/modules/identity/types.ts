export const ORG_ROLES = [
  "owner",
  "admin",
  "member",
  "viewer",
  "partner",
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const MODULE_KEYS = [
  "crm",
  "documents",
  "delivery",
  "finance",
  "partners",
  "portal",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type OrgModules = Record<ModuleKey, boolean>;

export const DEFAULT_MODULES: OrgModules = {
  crm: true,
  documents: true,
  delivery: true,
  finance: true,
  partners: true,
  portal: false,
};

export type Organization = {
  id: string;
  slug: string;
  name: string;
  defaultCurrency: "USD" | "INR";
  timezone: string;
  modules: OrgModules;
};

export const RESERVED_ORG_SLUGS = new Set([
  "login",
  "signup",
  "auth",
  "api",
  "brand",
  "onboarding",
  "app",
  "portal",
]);

export const DEMO_ORGANIZATION: Organization = {
  id: "demo-org",
  slug: "studio",
  name: "Worklane Studio",
  defaultCurrency: "USD",
  timezone: "America/New_York",
  modules: DEFAULT_MODULES,
};
