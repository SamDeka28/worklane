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
      "mcp/www_authenticate": [
        `'Bearer realm="worklane", resource_metadata="${origin}/.well-known/oauth-protected-resource", error="insufficient_scope", error_description="You need to login to continue", scope="worklane:read"'`,
      ],
    },
  };
}

const auth = {
  annotations: { readOnlyHint: true },
  _meta: {
    securitySchemes: [{ type: "oauth2", scopes: ["worklane:read"] }],
  },
};

export function createWorklaneMcpServer(input: {
  origin: string;
  reader?: { supabase: SupabaseClient; userId: string } | null;
}) {
  const reader = input.reader;
  const origin = input.origin;
  const server = new McpServer(
    { name: "Worklane", version: "1.0.0" },
    {
      instructions:
        "Read the signed-in member's Worklane studios. If a tool says authentication is required, ask the user to connect Worklane. Do not invent records, and do not claim you can create or send anything.",
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

  return server;
}
