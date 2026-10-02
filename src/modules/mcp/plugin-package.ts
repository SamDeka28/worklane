export const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
export const MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

export const WORKLANE_SKILL = `---
name: read-worklane
description: Read a member's Worklane studio, including questions the screens do not answer. Use for clients, projects, hours, charges, receipts, invoices, leads, partners, documents, or the team.
---

Worklane is connected through the Worklane MCP server. You can read the studio records the signed-in member is allowed to open.

- Call list_studios first when the studio is not already known.
- Pass org (the studio slug) on every other tool when the member belongs to more than one studio.
- For a total, a period, a comparison, or a question that combines records, call describe_studio_data, then query_studio. If the first result is not enough, call query_studio again with nextCursor, a tighter filter, or a related dataset. Do not stop at list_projects or list_invoices when those cards do not contain the answer.
- Name money for what it is. billed is non-void charges by charged_on. collected is posted receipts minus refunds by paid_on. contracted is the agreement amount on a project. outstanding is billed minus collected plus refunds. These are not interchangeable. Never add different currencies into one total. Set measure on query_studio for those questions.
- A sum of any other column is that column only. Say the column name. hours_millis is milliseconds; the result also includes hours.
- list_clients, get_client, list_projects, get_project, list_invoices, get_invoice, list_leads, and get_lead open one record by id. They are not the whole studio.
- These tools are read-only. Do not claim you created a client, posted a charge, sent an email, or changed a record.
- If a tool says this member cannot see finance or a module, say that plainly. Do not invent a zero.
- Answer from tool results. Do not invent ids, amounts, or statuses. If nextCursor is set, the list is not complete.
`;

export function pluginManifest(origin: string) {
  return {
    $schema: PLUGIN_SCHEMA,
    name: "worklane",
    version: "1.0.0",
    description: "Read your Worklane studio, including totals and questions the screens do not answer.",
    author: { name: "Worklane", url: `${origin}/connect` },
    license: "UNLICENSED",
    keywords: ["worklane", "studio", "invoices", "projects", "leads"],
    extensions: {
      "com.openai": {
        interface: {
          displayName: "Worklane",
          shortDescription: "Read studio records, totals, and questions the screens do not answer.",
          longDescription:
            "Connects ChatGPT to Worklane. Signing in on the Connect page shares read access for the studios you belong to. The assistant can query the records you can already open. Worklane does not let the assistant create, change, or send anything.",
          developerName: "Worklane",
          category: "Productivity",
          capabilities: ["Read"],
          websiteURL: origin,
          privacyPolicyURL: `${origin}/privacy`,
          termsOfServiceURL: `${origin}/terms`,
          logo: "./assets/logo.png",
          composerIcon: "./assets/logo.png",
          defaultPrompt: [
            "What studios can I see in Worklane?",
            "Which invoices are still open?",
            "Summarize my active projects.",
          ],
          brandColor: "#4F46E5",
        },
      },
    },
  };
}

export function mcpManifest(origin: string) {
  return {
    $schema: MCP_SCHEMA,
    mcpServers: {
      worklane: {
        type: "streamable-http",
        url: `${origin}/mcp`,
      },
    },
  };
}

export function codexManifest(origin: string) {
  return {
    name: "worklane",
    version: "1.0.0",
    description: "Read your Worklane studio, including totals and questions the screens do not answer.",
    skills: "./skills/",
    interface: {
      displayName: "Worklane",
      shortDescription: "Read studio records, totals, and questions the screens do not answer.",
      developerName: "Worklane",
      category: "Productivity",
      capabilities: ["Read"],
      websiteURL: `${origin}/connect`,
    },
  };
}

export function pluginEntries(origin: string) {
  return [
    { name: "plugin.json", text: `${JSON.stringify(pluginManifest(origin), null, 2)}\n` },
    { name: "mcp.json", text: `${JSON.stringify(mcpManifest(origin), null, 2)}\n` },
    { name: "skills/read-worklane/SKILL.md", text: WORKLANE_SKILL },
    { name: ".codex-plugin/plugin.json", text: `${JSON.stringify(codexManifest(origin), null, 2)}\n` },
  ];
}
