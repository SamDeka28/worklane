"use server";

import type { MentionItem } from "@/components/editor/mention-suggestion";
import { listOrgMembers, requireOrg } from "@/modules/identity/org";
import { canAccessModule } from "@/modules/identity/permissions";

const LIMIT = 400;

/** Everything taggable with "@" that this member can see, across the studio. */
export async function listMentionCatalogAction(orgSlug: string): Promise<MentionItem[]> {
  const ctx = await requireOrg(orgSlug);
  const orgId = ctx.org.id;
  const can = (module: "crm" | "delivery" | "partners") =>
    ctx.org.modules[module] !== false && canAccessModule(ctx.permissions, module);

  const [members, partners, clients, leads, projects, milestones, tasks] = await Promise.all([
    listOrgMembers(orgSlug).catch(() => []),
    can("partners")
      ? ctx.supabase
          .from("partners")
          .select("id, name")
          .eq("organization_id", orgId)
          .eq("active", true)
          .order("name")
          .limit(LIMIT)
      : null,
    can("crm")
      ? ctx.supabase
          .from("clients")
          .select("id, name")
          .eq("organization_id", orgId)
          .order("name")
          .limit(LIMIT)
      : null,
    can("crm")
      ? ctx.supabase
          .from("leads")
          .select("id, name")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false })
          .limit(LIMIT)
      : null,
    can("delivery")
      ? ctx.supabase
          .from("projects")
          .select("id, name")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false })
          .limit(LIMIT)
      : null,
    can("delivery")
      ? ctx.supabase
          .from("milestones")
          .select("id, name")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(LIMIT)
      : null,
    can("delivery")
      ? ctx.supabase
          .from("tasks")
          .select("id, title")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false })
          .limit(LIMIT)
      : null,
  ]);

  const rows = (result: { data: Record<string, unknown>[] | null } | null) => result?.data ?? [];

  return [
    ...members
      .filter((member) => member.status === "active" && member.role !== "partner")
      .map((member) => ({
        id: member.userId,
        label: member.displayName || member.email?.split("@")[0] || "Teammate",
        type: "member",
      })),
    ...rows(partners).map((row) => ({ id: row.id as string, label: row.name as string, type: "partner" })),
    ...rows(clients).map((row) => ({ id: row.id as string, label: row.name as string, type: "client" })),
    ...rows(leads).map((row) => ({ id: row.id as string, label: row.name as string, type: "lead" })),
    ...rows(projects).map((row) => ({ id: row.id as string, label: row.name as string, type: "project" })),
    ...rows(milestones).map((row) => ({
      id: row.id as string,
      label: row.name as string,
      type: "milestone",
    })),
    ...rows(tasks).map((row) => ({ id: row.id as string, label: row.title as string, type: "task" })),
  ];
}
