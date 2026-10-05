import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrgContext } from "@/modules/identity/org";
import { z } from "zod";
import { bearerChallenge, READ_SCOPE, WRITE_SCOPE } from "@/modules/mcp/origin";
import { attentionFor, entityContext, financialSnapshot, projectHealth, studioHealth } from "@/modules/mcp/intelligence";
import { registerStudioActions } from "@/modules/mcp/writes";
import { describeStudioData, queryStudio } from "@/modules/mcp/query";
import {
  readClient,
  readClients,
  readInvoice,
  readInvoices,
  readLead,
  readLeads,
  readProject,
  readProjects,
  readStudios,
  studioFor,
  TOOL_NOTE,
} from "@/modules/mcp/reads";

const orgField = z
  .string()
  .optional()
  .describe("Studio slug. Required when you belong to more than one studio.");

function result(data: unknown) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return {
      content: [{ type: "text" as const, text: data.error }],
      isError: true as const,
    };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

/** Tells ChatGPT to show the Connect button instead of answering without an account. */
export function connectRequired(origin: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: "Authentication required: no access token provided.",
      },
    ],
    isError: true as const,
    _meta: {
      "mcp/www_authenticate": [`'${bearerChallenge(origin, READ_SCOPE)}'`],
    },
  };
}

/** A read-only connection has to be approved again before it can change the studio. */
export function writeRequired(origin: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: "This connection can read Worklane but cannot change it. Connect again and allow changes.",
      },
    ],
    isError: true as const,
    _meta: {
      "mcp/www_authenticate": [
        `'${bearerChallenge(origin, WRITE_SCOPE, "Allow changes to continue")}'`,
      ],
    },
  };
}

const auth = {
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  _meta: {
    securitySchemes: [{ type: "oauth2", scopes: ["worklane:read"] }],
  },
};

export function createWorklaneMcpServer(input: {
  origin: string;
  reader?: { supabase: SupabaseClient; userId: string; scopes?: string[] } | null;
}) {
  const reader = input.reader;
  const origin = input.origin;
  const server = new McpServer(
    { name: "Worklane", version: "1.0.0" },
    {
      instructions:
        "Call Worklane tools for this member's studios. Pass org when they belong to more than one studio. Documents use the studio templates. Call list_document_templates and follow each template's design. To place a cover, fact grid, formatted table, image, diagram, callout, or signature block, call list_document_blocks and then compose_document. Upload the asset first using upload_asset. Use the returned fileId in compose_document image blocks. Do not invent fileIds. A diagram block is nodes and edges, drawn by the editor and the PDF. Those blocks are the same ones the editor inserts. Then create_document, create_proposal, or create_sow with templateId and data that fills that layout. Pass deliverables, milestones, roles, and paymentSchedule as row objects, one per table row. Do not copy one string into every row, do not write a new layout, and do not use write_document or a Markdown body. A lead id is not a client. preview_document must include the document id. Its previewUrl is the saved document the editor shows. A call without an id returns the blank template, not the saved document. send_document is Send by email: it attaches that PDF and emails the client a private link so they can sign. countersign_document signs for the studio after the client has signed. send_signed_copy emails the signed PDF. reply_document emails the client a reply. cc is a comma-separated list of up to 5 addresses on send_document, send_signed_copy, send_email, send_lead_email, send_invoice, and send_timesheet. For how the studio is doing, what needs attention, or one project, client, or lead, call get_studio_health, get_attention_items, get_next_actions, get_project_health, get_entity_context, or get_financial_snapshot. Use query_studio for anything else. billed, collected, outstanding, overdue, and contracted are different, and currencies stay separate. Claim a create, change, send, void, or delete only when the tool result says it happened.",
    },
  );

  server.registerTool(
    "get_profile",
    {
      title: "Get profile",
      description:
        "Return the profile represented by this request's authenticated credentials. The opaque id is unique within Worklane and remains unchanged across token refresh, reconnection, and display-metadata changes.",
      inputSchema: {},
      outputSchema: {
        id: z.string().describe("Stable Worklane user id."),
        name: z.string().optional(),
        email: z.string().optional(),
        nickname: z.string().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        ...auth._meta,
        "openai/profile": true,
      },
    },
    async () => {
      if (!reader) return connectRequired(origin);
      const { data } = await reader.supabase
        .from("profiles")
        .select("email, display_name")
        .eq("id", reader.userId)
        .maybeSingle();
      const name = typeof data?.display_name === "string" && data.display_name.trim() ? data.display_name.trim() : undefined;
      const email = typeof data?.email === "string" && data.email.trim() ? data.email.trim() : undefined;
      const profile = {
        id: reader.userId,
        ...(name ? { name, nickname: name } : {}),
        ...(email ? { email } : {}),
      };
      return {
        structuredContent: profile,
        content: [{ type: "text" as const, text: JSON.stringify(profile) }],
      };
    },
  );

  server.registerTool(
    "list_studios",
    {
      title: "List studios",
      description: `List the studios you belong to. ${TOOL_NOTE}`,
      ...auth,
    },
    async () => (reader ? result(await readStudios(reader)) : connectRequired(origin)),
  );

  server.registerTool(
    "describe_studio_data",
    {
      title: "Describe studio data",
      description: `List every dataset and field this member may read, including what money fields mean. Call this before guessing field names. ${TOOL_NOTE}`,
      inputSchema: { org: orgField },
      ...auth,
    },
    async (input) => (reader ? result(await describeStudioData(reader, input)) : connectRequired(origin)),
  );

  server.registerTool(
    "query_studio",
    {
      title: "Query studio",
      description: `Filter, search, group, aggregate, compare a period, and include a related dataset. Money questions about what was billed, collected, outstanding, overdue, or contracted must set measure. Currencies stay separate. If nextCursor is set, call again with that cursor before treating the list as complete. ${TOOL_NOTE}`,
      inputSchema: {
        org: orgField,
        dataset: z
          .string()
          .optional()
          .describe("Dataset name from describe_studio_data. Omit when measure is set."),
        measure: z
          .enum(["billed", "collected", "outstanding", "overdue", "contracted"])
          .optional()
          .describe(
            "Ledger total. billed is charges by charged_on. collected is receipts minus refunds by paid_on. contracted is the project agreement, not cash.",
          ),
        fields: z.array(z.string()).optional().describe("Field names to return. Omit for all readable fields."),
        filters: z
          .array(
            z.object({
              field: z.string(),
              op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "is_null"]),
              value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
            }),
          )
          .optional()
          .describe("Filters on catalog fields. Measures accept client_id and project_id only."),
        text: z.string().optional().describe("Search names, notes, and descriptions on this dataset."),
        period: z
          .object({
            relative: z.enum(["this_month", "last_month", "last_30_days"]).optional(),
            from: z.string().optional().describe("Inclusive YYYY-MM-DD in the studio timezone."),
            to: z.string().optional().describe("Exclusive YYYY-MM-DD."),
          })
          .optional()
          .describe("Resolved in the studio timezone, not the assistant clock."),
        groupBy: z
          .array(z.string())
          .optional()
          .describe("Field names, or month to group the dataset date by YYYY-MM."),
        aggregates: z
          .array(
            z.object({
              fn: z.enum(["count", "sum", "min", "max"]),
              field: z.string().optional(),
            }),
          )
          .optional(),
        comparePrevious: z
          .boolean()
          .optional()
          .describe("Also return the previous period of the same length."),
        include: z
          .array(z.string())
          .optional()
          .describe("Up to 3 directly related dataset names from the catalog."),
        cursor: z.string().optional().describe("nextCursor from the previous page."),
        limit: z.number().int().min(1).max(100).optional(),
        context: z
          .boolean()
          .optional()
          .describe("Also return up to three directly related datasets, including notes and document text."),
      },
      ...auth,
    },
    async (input) => (reader ? result(await queryStudio(reader, input)) : connectRequired(origin)),
  );

  server.registerTool(
    "list_clients",
    {
      description: `Search clients by name, with currency and primary contact. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, query: z.string().optional().describe("Name to search for.") },
      ...auth,
    },
    async (input) => (reader ? result(await readClients(reader, input)) : connectRequired(origin)),
  );

  server.registerTool(
    "get_client",
    {
      description: `Read one client: name, currency, and primary contact. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, id: z.string().describe("Client id.") },
      ...auth,
    },
    async (input) => (reader ? result(await readClient(reader, input)) : connectRequired(origin)),
  );

  server.registerTool(
    "list_projects",
    {
      description: `List projects with status, billing mode, and client. Money is included only when you can see finance. ${TOOL_NOTE}`,
      inputSchema: { org: orgField },
      ...auth,
    },
    async (input) => (reader ? result(await readProjects(reader, input)) : connectRequired(origin)),
  );

  server.registerTool(
    "get_project",
    {
      description: `Read one project. Money is included only when you can see finance. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, id: z.string().describe("Project id.") },
      ...auth,
    },
    async (input) => (reader ? result(await readProject(reader, input)) : connectRequired(origin)),
  );

  server.registerTool(
    "list_invoices",
    {
      description: `List invoices with status, due date, total, and balance. ${TOOL_NOTE}`,
      inputSchema: { org: orgField },
      ...auth,
    },
    async (input) => (reader ? result(await readInvoices(reader, input)) : connectRequired(origin)),
  );

  server.registerTool(
    "get_invoice",
    {
      description: `Read one invoice: status, due date, total, and balance. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, id: z.string().describe("Invoice id.") },
      ...auth,
    },
    async (input) => (reader ? result(await readInvoice(reader, input)) : connectRequired(origin)),
  );

  server.registerTool(
    "list_leads",
    {
      description: `List leads with stage, company, and estimated value. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, query: z.string().optional().describe("Name or company to search for.") },
      ...auth,
    },
    async (input) => (reader ? result(await readLeads(reader, input)) : connectRequired(origin)),
  );

  server.registerTool(
    "get_lead",
    {
      description: `Read one lead: stage, company, and estimated value. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, id: z.string().describe("Lead id.") },
      ...auth,
    },
    async (input) => (reader ? result(await readLead(reader, input)) : connectRequired(origin)),
  );

  const withStudio = async (input: { org?: string }, fn: (ctx: OrgContext) => Promise<unknown>) => {
    if (!reader) return connectRequired(origin);
    const ctx = await studioFor(reader, input.org);
    if ("error" in ctx) return result(ctx);
    return result(await fn(ctx));
  };

  server.registerTool(
    "get_studio_health",
    {
      title: "Studio health",
      description: "One view of the studio: active projects, open leads, money by currency, and the first items that need attention.",
      inputSchema: { org: orgField },
      ...auth,
    },
    async (input) => withStudio(input, (ctx) => studioHealth(ctx)),
  );
  server.registerTool(
    "get_attention_items",
    {
      title: "What needs attention",
      description: "Overdue charges, lead follow-ups, overdue tasks and milestones, and documents still waiting for a signature.",
      inputSchema: { org: orgField },
      ...auth,
    },
    async (input) => withStudio(input, (ctx) => attentionFor(ctx)),
  );
  server.registerTool(
    "get_next_actions",
    {
      title: "Next actions",
      description: "The due and overdue items to handle next, including each lead's stored next action.",
      inputSchema: { org: orgField },
      ...auth,
    },
    async (input) => withStudio(input, async (ctx) => ({ actions: await attentionFor(ctx) })),
  );
  server.registerTool(
    "get_project_health",
    {
      title: "Project health",
      description: "Status, client, tasks, hours, milestones, documents, money when visible, and the next action for one project.",
      inputSchema: { org: orgField, id: z.string().describe("Project id.") },
      ...auth,
    },
    async (input) => withStudio(input, (ctx) => projectHealth(ctx, input.id)),
  );
  server.registerTool(
    "get_entity_context",
    {
      title: "Entity context",
      description: "Context for one client, project, or lead. Pass kind as client, project, or lead, and id.",
      inputSchema: {
        org: orgField,
        id: z.string().describe("Client, project, or lead id."),
        kind: z.enum(["client", "project", "lead"]).describe("Which record id refers to."),
      },
      ...auth,
    },
    async (input) =>
      withStudio(input, (ctx) =>
        entityContext(ctx, {
          id: input.id,
          kind: input.kind,
          clientId: input.kind === "client" ? input.id : undefined,
          projectId: input.kind === "project" ? input.id : undefined,
          leadId: input.kind === "lead" ? input.id : undefined,
        }),
      ),
  );
  server.registerTool(
    "get_financial_snapshot",
    {
      title: "Financial snapshot",
      description: "Billed, collected, outstanding, overdue, and contracted, kept separate by currency. Optional client or project scope.",
      inputSchema: {
        org: orgField,
        clientId: z.string().optional(),
        projectId: z.string().optional(),
      },
      ...auth,
    },
    async (input) => withStudio(input, (ctx) => financialSnapshot(ctx, input)),
  );

  registerStudioActions(server, { origin, reader: reader ?? null, connectRequired, writeRequired, result });

  return server;
}
