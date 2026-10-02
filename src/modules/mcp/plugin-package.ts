export const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
export const MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

export const WORKLANE_SKILL = `---
name: read-worklane
description: Read a member's Worklane studios, clients, projects, invoices, and leads. Use when the user asks about studio work, who a client is, project status, what is owed, or the lead pipeline.
---

Worklane is connected through the Worklane MCP server. You can read studios, clients, projects, invoices, and leads for the signed-in member.

- Call list_studios first when the studio is not already known.
- Pass org (the studio slug) on every other tool when the member belongs to more than one studio.
- These tools are read-only. Do not claim you created a client, posted a charge, sent an email, or changed a record.
- Invoice totals and project money appear only when this member can see finance. If a tool says they do not have access, say that plainly.
- Answer from tool results. Do not invent ids, amounts, or statuses.
`;

export function pluginManifest(origin: string) {
  return {
    $schema: PLUGIN_SCHEMA,
    name: "worklane",
    version: "1.0.0",
    description: "Read your Worklane studios, clients, projects, invoices, and leads.",
    author: { name: "Worklane", url: `${origin}/connect` },
    license: "UNLICENSED",
    keywords: ["worklane", "studio", "invoices", "projects", "leads"],
    extensions: {
      "com.openai": {
        interface: {
          displayName: "Worklane",
          shortDescription: "Read studios, clients, projects, invoices, and leads.",
          longDescription:
            "Connects ChatGPT to Worklane. Signing in on the Connect page shares read access for the studios you belong to. Worklane does not let the assistant create, change, or send anything.",
          developerName: "Worklane",
          category: "Productivity",
          capabilities: ["Read"],
          websiteURL: `${origin}/connect`,
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
    description: "Read your Worklane studios, clients, projects, invoices, and leads.",
    skills: "./skills/",
    interface: {
      displayName: "Worklane",
      shortDescription: "Read studios, clients, projects, invoices, and leads.",
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
