import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
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

export function createWorklaneMcpServer(reader: { supabase: SupabaseClient; userId: string }) {
  const server = new McpServer({ name: "worklane", version: "1.0.0" });

  server.registerTool(
    "list_studios",
    {
      description: `List the studios you belong to. ${TOOL_NOTE}`,
      annotations: { readOnlyHint: true },
    },
    async () => result(await readStudios(reader)),
  );

  server.registerTool(
    "list_clients",
    {
      description: `Search clients by name, with currency and primary contact. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, query: z.string().optional().describe("Name to search for.") },
      annotations: { readOnlyHint: true },
    },
    async (input) => result(await readClients(reader, input)),
  );

  server.registerTool(
    "get_client",
    {
      description: `Read one client: name, currency, and primary contact. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, id: z.string().describe("Client id.") },
      annotations: { readOnlyHint: true },
    },
    async (input) => result(await readClient(reader, input)),
  );

  server.registerTool(
    "list_projects",
    {
      description: `List projects with status, billing mode, and client. Money is included only when you can see finance. ${TOOL_NOTE}`,
      inputSchema: { org: orgField },
      annotations: { readOnlyHint: true },
    },
    async (input) => result(await readProjects(reader, input)),
  );

  server.registerTool(
    "get_project",
    {
      description: `Read one project. Money is included only when you can see finance. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, id: z.string().describe("Project id.") },
      annotations: { readOnlyHint: true },
    },
    async (input) => result(await readProject(reader, input)),
  );

  server.registerTool(
    "list_invoices",
    {
      description: `List invoices with status, due date, total, and balance. ${TOOL_NOTE}`,
      inputSchema: { org: orgField },
      annotations: { readOnlyHint: true },
    },
    async (input) => result(await readInvoices(reader, input)),
  );

  server.registerTool(
    "get_invoice",
    {
      description: `Read one invoice: status, due date, total, and balance. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, id: z.string().describe("Invoice id.") },
      annotations: { readOnlyHint: true },
    },
    async (input) => result(await readInvoice(reader, input)),
  );

  server.registerTool(
    "list_leads",
    {
      description: `List leads with stage, company, and estimated value. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, query: z.string().optional().describe("Name or company to search for.") },
      annotations: { readOnlyHint: true },
    },
    async (input) => result(await readLeads(reader, input)),
  );

  server.registerTool(
    "get_lead",
    {
      description: `Read one lead: stage, company, and estimated value. ${TOOL_NOTE}`,
      inputSchema: { org: orgField, id: z.string().describe("Lead id.") },
      annotations: { readOnlyHint: true },
    },
    async (input) => result(await readLead(reader, input)),
  );

  return server;
}
