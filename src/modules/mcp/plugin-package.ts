export const PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
export const MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
export const PLUGIN_NAME = "worklane";
export const PLUGIN_VERSION = "1.3.0";

/** Pulls `asdk_app_…` out of an id or a ChatGPT address that contains `plugin_asdk_app_…`. */
export function parseWorklaneAppId(value: string): string | null {
  const match = value.trim().match(/asdk_app_[a-f0-9]{16,}/i);
  return match ? match[0].toLowerCase() : null;
}

const DESCRIPTION =
  "Read and change your Worklane studio, including notes, documents, and records you have access to.";

export const WORKLANE_SKILL = `---
name: read-worklane
description: Read and change a member's Worklane studio. Use for clients, projects, hours, charges, receipts, invoices, leads, partners, documents, email, or the team.
---

Worklane is connected through the Worklane MCP app. Read the records the signed-in member can open, and change them when the connection includes write access. If authentication is required, allow ChatGPT to trigger the app's authentication flow rather than directing the user to desktop.

- Call list_studios first when the studio is not already known.
- Pass org (the studio slug) on every other tool when the member belongs to more than one studio.
- For an open question, call describe_studio_data, then query_studio with context true. Keep querying with nextCursor, a tighter filter, or a related dataset until the answer is in the notes, document text, emails, timeline, or settings. Do not stop at a status or a total when the question is about what was said or written.
- If a tool says this member cannot see a module, say that plainly. Do not invent a zero or a note.
- Name money for what it is. billed is non-void charges by charged_on. collected is posted receipts minus refunds by paid_on. contracted is the agreement amount on a project. outstanding is billed minus collected plus refunds. These are not interchangeable. Never add different currencies into one total. Set measure on query_studio for those questions.
- A sum of any other column is that column only. Say the column name. hours_millis is milliseconds; the result also includes hours.
- Issue an invoice with issue_invoice, then email it with send_invoice. Create milestones, bill them with bill_milestone, invite people with invite_member, and record partner payouts with record_settlement. Do not claim any of those happened unless the tool result says so.
- Use the write tools for changes. Create a proposal or SOW by calling list_document_templates and following that template's design. Then create_document, create_proposal, or create_sow with templateId and data that fills the existing cover, sections, and tables. For an SOW, deliverables, milestones, roles, and paymentSchedule are row objects, one per table row. Do not write a new layout as Markdown, and do not call write_document on a templated document. To place a cover, fact grid, formatted table, image, diagram, callout, or signature block, call list_document_blocks and then compose_document. Those are the same blocks the editor inserts. Upload an image with upload_asset and pass the returned fileId on the image block. A diagram block has layout row, stack, hub, or timeline, nodes with id and label, and edges with from and to. placement append adds them to the saved document. body is ignored when templateId, kind, or data is set. preview_document must include the document id. That previewUrl is the saved document the editor shows. A preview_document call without an id returns the blank template, not the saved document. Do not invent fees or dates; leave those fields out and report the validation warnings. send_document attaches that PDF and emails the signing link, and is the only way a document becomes sent. countersign_document signs for the studio after the client has signed. send_signed_copy emails the signed PDF. Do not mark a document sent or signed yourself. preview_document with id previews that document. With projectId it previews the project's documents, including ones linked only to the project's client. With clientId it previews that client's documents. With none of those it returns the blank template and does not save. Do not present that as the document. cc on send_lead_email, send_email, send_document, send_signed_copy, send_invoice, and send_timesheet is a comma-separated list. For how the studio is doing or what needs attention, call get_studio_health, get_attention_items, or get_next_actions. On send_lead_email and send_email, set includeSignature true only when the member asks to include their email signature. That adds the saved signature under the message. Do not paste a signature into the body, and do not say it was included unless the result says signatureIncluded. Email attachments are a JSON array on attachments, each with filename, contentType, and contentBase64, up to 5 files and 5 MB each. Ask for another template or invoice layout when the member wants to compare them. The numbers do not change between invoice layouts.
- Amounts in write tools are major units, such as 1500, in the client's currency.
- Do not claim you sent, voided, or deleted something unless the tool result says it did.
- A vault secret is returned only by reveal_credential, and only when the member asked for that entry. Do not repeat a mailbox password or an invitation token.
- Answer from tool results. Do not invent ids, amounts, or statuses. If nextCursor is set, the list is not complete.
`;

function interfaceBlock(origin: string) {
  return {
    displayName: "Worklane",
    shortDescription: "Work with your Worklane studio directly in ChatGPT.",
    longDescription:
      "Connects ChatGPT to Worklane using your existing Worklane access. If you are not authenticated, ChatGPT can prompt you to authenticate before using protected actions.",
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
  };
}

export function appManifest(appId: string) {
  return {
    apps: {
      worklane: {
        id: appId,
        required: true,
      },
    },
  };
}

export function pluginManifest(origin: string) {
  return {
    $schema: PLUGIN_SCHEMA,
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: DESCRIPTION,
    author: { name: "Worklane", url: `${origin}/connect` },
    license: "UNLICENSED",
    keywords: ["worklane", "studio", "invoices", "projects", "leads"],
    extensions: {
      "com.openai": {
        apps: "./.app.json",
        interface: interfaceBlock(origin),
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

export function dotMcpManifest(origin: string) {
  return {
    mcpServers: {
      worklane: {
        type: "streamable-http",
        url: `${origin}/mcp`,
        headers: {},
      },
    },
  };
}

export function codexManifest(origin: string) {
  return {
    apps: "./.app.json",
    interface: interfaceBlock(origin),
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: DESCRIPTION,
    author: { name: "Worklane", url: `${origin}/connect` },
    keywords: ["worklane", "studio", "invoices", "projects", "leads"],
    license: "UNLICENSED",
    skills: "./skills",
    mcpServers: "./.mcp.json",
  };
}

export function pluginEntries(origin: string, appId: string) {
  return [
    { name: ".app.json", text: `${JSON.stringify(appManifest(appId), null, 2)}\n` },
    { name: ".mcp.json", text: `${JSON.stringify(dotMcpManifest(origin), null, 2)}\n` },
    { name: "mcp.json", text: `${JSON.stringify(mcpManifest(origin), null, 2)}\n` },
    { name: "plugin.json", text: `${JSON.stringify(pluginManifest(origin), null, 2)}\n` },
    { name: ".codex-plugin/plugin.json", text: `${JSON.stringify(codexManifest(origin), null, 2)}\n` },
    { name: "skills/read-worklane/SKILL.md", text: WORKLANE_SKILL },
  ];
}
