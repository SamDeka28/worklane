import type { OrgContext } from "@/modules/identity/org";

export type DocumentLinks = {
  clientId: string | null;
  projectId: string | null;
  leadId: string | null;
  clientName: string | null;
  projectName: string | null;
  warning?: string;
};

async function clientById(ctx: OrgContext, id: string) {
  const { data } = await ctx.supabase
    .from("clients")
    .select("id, name")
    .eq("organization_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  return data ? { id: data.id as string, name: data.name as string } : null;
}

async function leadById(ctx: OrgContext, id: string) {
  const { data } = await ctx.supabase
    .from("leads")
    .select("id, name, client_id")
    .eq("organization_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  return data
    ? { id: data.id as string, name: data.name as string, clientId: (data.client_id as string | null) ?? null }
    : null;
}

/**
 * Resolves document links to real client and project rows.
 * A lead id is never stored as a client. A lead with no client stays unlinked.
 */
export async function resolveDocumentLinks(
  ctx: OrgContext,
  input: { clientId?: string | null; projectId?: string | null; leadId?: string | null },
): Promise<{ error: string } | DocumentLinks> {
  let clientId = input.clientId?.trim() || null;
  let projectId = input.projectId?.trim() || null;
  let leadId = input.leadId?.trim() || null;
  let clientName: string | null = null;
  let projectName: string | null = null;
  let warning: string | undefined;

  if (projectId) {
    const { data: project } = await ctx.supabase
      .from("projects")
      .select("id, name, client_id")
      .eq("organization_id", ctx.org.id)
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return { error: "Project not found" };
    projectId = project.id as string;
    projectName = project.name as string;
    if (!clientId && project.client_id) clientId = project.client_id as string;
  }

  if (clientId) {
    const client = await clientById(ctx, clientId);
    if (client) {
      clientId = client.id;
      clientName = client.name;
    } else {
      const lead = await leadById(ctx, clientId);
      if (!lead) return { error: "Client not found" };
      leadId = lead.id;
      clientId = null;
      if (lead.clientId) {
        const converted = await clientById(ctx, lead.clientId);
        if (converted) {
          clientId = converted.id;
          clientName = converted.name;
        }
      }
      if (!clientId) {
        warning = `${lead.name} is a lead and has not been converted to a client. The document stays unlinked.`;
      }
    }
  }

  if (leadId) {
    const lead = await leadById(ctx, leadId);
    if (!lead) return { error: "Lead not found" };
    leadId = lead.id;
    if (!clientId && lead.clientId) {
      const converted = await clientById(ctx, lead.clientId);
      if (converted) {
        clientId = converted.id;
        clientName = converted.name;
      }
    }
    if (!clientId) {
      warning = `${lead.name} is a lead and has not been converted to a client. The document stays unlinked.`;
    }
  }

  return { clientId, projectId, leadId, clientName, projectName, warning };
}
