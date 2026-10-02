export const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
export const MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

export const WORKLANE_SKILL = `---
name: read-worklane
description: Read and change a member's Worklane studio. Use for clients, projects, hours, charges, receipts, invoices, leads, partners, documents, email, or the team.
---

Worklane is connected through the Worklane MCP server. You can read the records the signed-in member can already open, and change them when the connection includes write access.

- Call list_studios first when the studio is not already known.
- Pass org (the studio slug) on every other tool when the member belongs to more than one studio.
- For an open question, call describe_studio_data, then query_studio with context true. Keep querying with nextCursor, a tighter filter, or a related dataset until the answer is in the notes, document text, emails, timeline, or settings. Do not stop at a status or a total when the question is about what was said or written.
- If a tool says this member cannot see a module, say that plainly. Do not invent a zero or a note.
- Name money for what it is. billed is non-void charges by charged_on. collected is posted receipts minus refunds by paid_on. contracted is the agreement amount on a project. outstanding is billed minus collected plus refunds. These are not interchangeable. Never add different currencies into one total. Set measure on query_studio for those questions.
- A sum of any other column is that column only. Say the column name. hours_millis is milliseconds; the result also includes hours.
- Use the write tools for changes. Preview a document, an invoice, or an email before you create or send it. Ask for another template or invoice layout when the member wants to compare them. The numbers do not change between invoice layouts.
- Amounts in write tools are major units, such as 1500, in the client's currency.
- Do not claim you sent, voided, or deleted something unless the tool result says it did.
- A vault secret is returned only by reveal_credential, and only when the member asked for that entry. Do not repeat a mailbox password or an invitation token.
- Answer from tool results. Do not invent ids, amounts, or statuses. If nextCursor is set, the list is not complete.
`;

export function pluginManifest(origin: string) {
  return {
    $schema: PLUGIN_SCHEMA,
    name: "worklane",
    version: "1.0.0",
    description: "Read and change your Worklane studio, including notes, documents, and the records the screens do not add up.",
    author: { name: "Worklane", url: `${origin}/connect` },
    license: "UNLICENSED",
    keywords: ["worklane", "studio", "invoices", "projects", "leads"],
    extensions: {
      "com.openai": {
        interface: {
          displayName: "Worklane",
          shortDescription: "Read and change studio records you already have access to.",
          longDescription:
            "Connects ChatGPT to Worklane. Signing in on the Connect page shares read access. Allowing changes lets the assistant create, update, and send using the same access you already have. You can disconnect later.",
          developerName: "Worklane",
          category: "Productivity",
          capabilities: ["Read", "Write"],
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
    description: "Read and change your Worklane studio, including notes, documents, and the records the screens do not add up.",
    skills: "./skills/",
    interface: {
      displayName: "Worklane",
      shortDescription: "Read and change studio records you already have access to.",
      developerName: "Worklane",
      category: "Productivity",
      capabilities: ["Read", "Write"],
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
