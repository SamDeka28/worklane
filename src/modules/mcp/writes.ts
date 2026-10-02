import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendLeadEmailForContext } from "@/modules/crm/email-actions";
import { countersignDocumentForContext, emailSignedCopyForContext } from "@/modules/documents/actions";
import { previewDocumentsForContext } from "@/modules/documents/preview";
import { sendTrackedEmailForContext } from "@/modules/emails/actions";
import {
  billMilestoneForContext,
  createMilestoneForContext,
  setMilestoneStatusForContext,
} from "@/modules/delivery/actions";
import {
  addInvoiceLineForContext,
  createDraftInvoiceForContext,
  issueInvoiceForContext,
  sendInvoiceForContext,
} from "@/modules/invoices/actions";
import {
  recordPartnerSettlementForContext,
  voidPartnerSettlementForContext,
} from "@/modules/partners/actions";
import { inviteMemberForContext } from "@/modules/team/actions";
import {
  createSowRecord,
  fillDocumentRecord,
  linkDocumentRecord,
  sendDocumentRecord,
  writeDocumentRecord,
} from "@/modules/documents/records";
import { parseEmailAttachments } from "@/shared/email/attachments";
import type { OrgContext } from "@/modules/identity/org";
import { studioFor } from "@/modules/mcp/reads";
import { WRITE_SCOPE } from "@/modules/mcp/origin";
import {
  addContactRecord,
  archiveClientRecord,
  commentOnTaskRecord,
  assertWrite,
  createChargeRecord,
  createClientRecord,
  createDocumentRecord,
  createLeadRecord,
  createPartnerRecord,
  createProjectRecord,
  createTaskRecord,
  createWorkLogRecord,
  deleteClientRecord,
  deleteProjectRecord,
  deleteTaskRecord,
  logLeadNoteRecord,
  moveLeadRecord,
  previewInvoiceRecord,
  recordPaymentRecord,
  renameStudioRecord,
  revealCredentialRecord,
  voidChargeRecord,
  voidPaymentRecord,
  setProjectStatusRecord,
  updateClientBillingRecord,
  updateClientRecord,
  updateTaskRecord,
} from "@/modules/records/mutate";

type Reader = { supabase: SupabaseClient; userId: string; scopes?: string[] };

const inputSchema = {
  org: z.string().optional().describe("Studio slug when you belong to more than one studio."),
  id: z.string().optional(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  leadId: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional().describe("Document text, email body, or note. For a document, this is saved as the content."),
  status: z.string().optional(),
  amount: z.string().optional().describe("Amount in major units, such as 1500."),
  gross: z.string().optional().describe("Charge amount in major units."),
  email: z.string().optional(),
  to: z.string().optional(),
  cc: z.string().optional().describe("CC addresses, separated by commas. Up to 5."),
  includeSignature: z
    .union([z.boolean(), z.string()])
    .optional()
    .describe(
      "On send_lead_email and send_email, set true when the member asks to include their email signature. The saved signature is added under that message. Leave unset otherwise.",
    ),
  subject: z.string().optional(),
  templateId: z.string().optional(),
  layout: z.string().optional().describe("Invoice layout: classic, minimal, bold, modern, elegant, studio, corporate, swiss, edge, letterhead, or ribbon."),
  confirmName: z.string().optional().describe("Exact record name required before a delete."),
  kind: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().optional(),
  billingMode: z.string().optional(),
  hours: z.string().optional(),
  description: z.string().optional(),
  stage: z.string().optional(),
  company: z.string().optional(),
  memo: z.string().optional(),
  scope: z.string().optional(),
  phone: z.string().optional(),
  dueOn: z.string().optional(),
  attachments: z
    .string()
    .optional()
    .describe("JSON array of email files: filename, contentType, and contentBase64. Up to 5 files, 5 MB each."),
};

type ToolInput = {
  org?: string;
  id?: string;
  clientId?: string;
  projectId?: string;
  leadId?: string;
  name?: string;
  title?: string;
  body?: string;
  status?: string;
  amount?: string;
  gross?: string;
  email?: string;
  to?: string;
  cc?: string;
  includeSignature?: boolean | string;
  subject?: string;
  templateId?: string;
  layout?: string;
  confirmName?: string;
  kind?: string;
  notes?: string;
  currency?: string;
  billingMode?: string;
  hours?: string;
  description?: string;
  stage?: string;
  company?: string;
  memo?: string;
  scope?: string;
  phone?: string;
  dueOn?: string;
  attachments?: string;
};

async function signedVersionId(ctx: OrgContext, documentId: string) {
  const { data } = await ctx.supabase
    .from("document_versions")
    .select("id")
    .eq("organization_id", ctx.org.id)
    .eq("document_id", documentId)
    .eq("status", "signed")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id;
}

function includeEmailSignature(value: boolean | string | undefined) {
  if (value === true) return true;
  return typeof value === "string" && /^(true|yes|1)$/i.test(value.trim());
}

function emailFiles(raw: string | undefined) {
  if (!raw?.trim()) {
    return { attachments: [] as { filename: string; content: Buffer; contentType: string }[] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Attachments must be a JSON array of filename, contentType, and contentBase64." };
  }
  return parseEmailAttachments(parsed);
}

const writeMeta = {
  securitySchemes: [{ type: "oauth2", scopes: [WRITE_SCOPE] }],
};

const readMeta = {
  securitySchemes: [{ type: "oauth2", scopes: ["worklane:read"] }],
};

export function registerStudioActions(
  server: McpServer,
  options: {
    origin: string;
    reader: Reader | null;
    connectRequired: (origin: string) => {
      content: { type: "text"; text: string }[];
      isError?: boolean;
      _meta?: Record<string, unknown>;
    };
    writeRequired: (origin: string) => {
      content: { type: "text"; text: string }[];
      isError?: boolean;
      _meta?: Record<string, unknown>;
    };
    result: (data: unknown) => {
      content: { type: "text"; text: string }[];
      isError?: boolean;
    };
  },
) {
  const { origin, reader, connectRequired, writeRequired, result } = options;
  const canWrite = Boolean(reader?.scopes?.includes(WRITE_SCOPE));

  const run = async (input: ToolInput, fn: (ctx: OrgContext) => Promise<unknown>) => {
    if (!reader) return connectRequired(origin);
    const ctx = await studioFor(reader, input.org);
    if ("error" in ctx) return result(ctx);
    return result(await fn(ctx));
  };

  const add = (
    name: string,
    description: string,
    destructive: boolean,
    writing: boolean,
    handle: (input: ToolInput) => Promise<{
      content: { type: "text"; text: string }[];
      isError?: boolean;
      _meta?: Record<string, unknown>;
    }>,
  ) => {
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: { readOnlyHint: !writing, destructiveHint: destructive, openWorldHint: false },
        _meta: writing ? writeMeta : readMeta,
      },
      async (input) => {
        if (!reader) return connectRequired(origin);
        if (writing && !canWrite) return writeRequired(origin);
        return handle(input as ToolInput);
      },
    );
  };

  add("preview_document", "Preview a saved document, the documents on a project, or the documents on a client. Pass id for one document, projectId for that project's documents (including ones linked only to its client), or clientId for a client's documents. With none of those, preview a template before saving. Returns the text. Does not save or send.", false, false, (input) =>
    run(input, (ctx) =>
      previewDocumentsForContext(ctx, {
        id: input.id,
        projectId: input.projectId,
        clientId: input.clientId,
        title: input.title || input.name,
        templateId: input.templateId,
      }),
    ),
  );
  add("preview_invoice", "Preview invoice content and compare layouts. Pass an invoice id to preview that invoice, or omit it to compare layouts. Does not save or send. Numbers do not change between layouts.", false, false, (input) =>
    run(input, (ctx) => previewInvoiceRecord(ctx, { id: input.id, layout: input.layout, currency: input.currency })),
  );

  add("create_client", "Create a client. Amounts are not involved. Pass name, and optionally kind, currency, email, and phone.", false, true, (input) =>
    run(input, (ctx) => createClientRecord(ctx, { name: input.name || "", kind: input.kind, notes: input.notes, currency: input.currency, email: input.email, phone: input.phone })),
  );
  add("update_client", "Update a client's name, notes, kind, or currency.", false, true, (input) =>
    run(input, (ctx) => updateClientRecord(ctx, input.id || "", { name: input.name, notes: input.notes, kind: input.kind, currency: input.currency })),
  );
  add("add_contact", "Add a contact on a client.", false, true, (input) =>
    run(input, (ctx) => addContactRecord(ctx, input.clientId || input.id || "", { name: input.name, email: input.email, phone: input.phone })),
  );
  add("update_client_billing", "Update the billing details printed on a client's invoices.", false, true, (input) =>
    run(input, (ctx) =>
      updateClientBillingRecord(ctx, input.clientId || input.id || "", {
        name: input.name || "",
        contactName: input.title || "",
        email: input.email || "",
        phone: input.phone || "",
        address: input.body || "",
        taxId: input.memo || "",
        extras: [],
      }),
    ),
  );
  add("archive_client", "Archive a client.", true, true, (input) => run(input, (ctx) => archiveClientRecord(ctx, input.id || "")));
  add("delete_client", "Delete a client. Pass confirmName equal to the client's name.", true, true, (input) =>
    run(input, (ctx) => deleteClientRecord(ctx, input.id || "", input.confirmName || "")),
  );
  add("rename_studio", "Rename the studio. Owners and admins only.", false, true, (input) =>
    run(input, (ctx) => renameStudioRecord(ctx, input.name || "")),
  );
  add("create_project", "Create a project for a client. contracted amount is an agreement, not cash, in major units.", false, true, (input) =>
    run(input, (ctx) =>
      createProjectRecord(ctx, {
        name: input.name || "",
        clientId: input.clientId || "",
        billingMode: input.billingMode,
        status: input.status,
        scope: input.scope,
        contractedAmount: input.amount,
      }),
    ),
  );
  add("set_project_status", "Set a project status: planning, active, on_hold, completed, or cancelled.", false, true, (input) =>
    run(input, (ctx) => setProjectStatusRecord(ctx, input.id || input.projectId || "", input.status || "")),
  );
  add("delete_project", "Delete a project. Pass confirmName equal to the project name.", true, true, (input) =>
    run(input, (ctx) => deleteProjectRecord(ctx, input.id || "", input.confirmName || "")),
  );
  add("create_task", "Create a task on a project.", false, true, (input) =>
    run(input, (ctx) => createTaskRecord(ctx, { projectId: input.projectId || "", title: input.title || input.name || "", description: input.description, status: input.status, dueOn: input.dueOn })),
  );
  add("update_task", "Update a task title, description, status, or due date.", false, true, (input) =>
    run(input, (ctx) => updateTaskRecord(ctx, input.id || "", { title: input.title, description: input.description, status: input.status, dueOn: input.dueOn })),
  );
  add("delete_task", "Delete a task.", true, true, (input) => run(input, (ctx) => deleteTaskRecord(ctx, input.id || "")));
  add("comment_on_task", "Add a comment on a task.", false, true, (input) =>
    run(input, (ctx) => commentOnTaskRecord(ctx, input.id || "", input.body || "")),
  );
  add("create_work_log", "Log hours on a project. Hours are a decimal, such as 1.5.", false, true, (input) =>
    run(input, (ctx) => createWorkLogRecord(ctx, { projectId: input.projectId || "", workedOn: input.dueOn, hours: input.hours, description: input.description })),
  );
  add("create_charge", "Bill a client. gross is major units. This is not cash received.", false, true, (input) =>
    run(input, (ctx) => createChargeRecord(ctx, { clientId: input.clientId || "", projectId: input.projectId, gross: input.gross || input.amount || "", memo: input.memo, chargedOn: input.dueOn })),
  );
  add("record_payment", "Record a receipt or refund. amount is major units. kind is receipt or refund.", false, true, (input) =>
    run(input, (ctx) => recordPaymentRecord(ctx, { clientId: input.clientId || "", amount: input.amount || "", kind: input.kind, reference: input.memo })),
  );
  add("void_charge", "Void a charge. It leaves billed totals.", true, true, (input) =>
    run(input, (ctx) => voidChargeRecord(ctx, input.id || "")),
  );
  add("void_payment", "Void a receipt or refund.", true, true, (input) =>
    run(input, (ctx) => voidPaymentRecord(ctx, input.id || "")),
  );
  add("create_lead", "Create a lead. estimated value is a forecast, not billed.", false, true, (input) =>
    run(input, (ctx) => createLeadRecord(ctx, { name: input.name || "", company: input.company, email: input.email, stage: input.stage, notes: input.notes, estimatedValue: input.amount })),
  );
  add("move_lead", "Move a lead to a stage slug.", false, true, (input) =>
    run(input, (ctx) => moveLeadRecord(ctx, input.id || input.leadId || "", input.stage || "")),
  );
  add("log_lead_note", "Log a note, call, or meeting on a lead. kind defaults to note.", false, true, (input) =>
    run(input, (ctx) => logLeadNoteRecord(ctx, input.id || input.leadId || "", input.body || "", input.kind)),
  );
  add("preview_email", "Preview an email before it is sent. Returns to, subject, and body. Does not send.", false, false, async (input) =>
    result({
      to: input.to || input.email || "",
      subject: input.subject || "",
      body: input.body || "",
      note: "This is the message. Sending is a separate step.",
    }),
  );
  add("send_lead_email", "Send an email to an existing lead. cc is comma-separated. Set includeSignature true only when the member asks to include their email signature; the saved signature is then added under the message. Do not say it was included unless the result says signatureIncluded. Preview the body first. This sends. attachments is a JSON array of filename, contentType, and contentBase64.", true, true, async (input) => {
    const files = emailFiles(input.attachments);
    if ("error" in files) return result(files);
    return run(input, (ctx) =>
      sendLeadEmailForContext(ctx, input.leadId || input.id || "", {
        to: input.to || input.email || "",
        cc: input.cc || "",
        subject: input.subject || "",
        body: input.body || "",
        trackOpens: true,
        includeSignature: includeEmailSignature(input.includeSignature),
        templateId: input.templateId || null,
        replyToId: null,
        followUp: null,
        moveToStage: input.stage || null,
        attachments: files.attachments.map((file) => ({
          filename: file.filename,
          contentType: file.contentType,
          contentBase64: file.content.toString("base64").replace(/=+$/, ""),
        })),
      }),
    );
  });
  add("create_document", "Create a draft. When body is set, that text is the document and the template is not used. The result text is what was stored. Omit body only to start from a template. This does not send it.", false, true, (input) =>
    run(input, (ctx) => createDocumentRecord(ctx, { title: input.title || input.name || "", templateId: input.templateId, clientId: input.clientId, projectId: input.projectId, body: input.body })),
  );
  add("write_document", "Replace a draft with the supplied body. The result text is exactly what was stored. Use this when a template saved the wrong content. Does not send or sign.", false, true, (input) =>
    run(input, (ctx) => writeDocumentRecord(ctx, { id: input.id || "", body: input.body || "", title: input.title })),
  );
  add("fill_document", "Replace [Placeholder] labels in a draft. body is one line per fill, such as Client name: Rentique. Does not send or sign.", false, true, (input) =>
    run(input, (ctx) => fillDocumentRecord(ctx, { id: input.id || "", body: input.body || input.notes || "", title: input.title })),
  );
  add("link_document", "Attach a client or project to a draft and fill Client name and Project name when those records exist.", false, true, (input) =>
    run(input, (ctx) => linkDocumentRecord(ctx, { id: input.id || "", clientId: input.clientId, projectId: input.projectId })),
  );
  add("create_sow", "Create a draft statement of work from a proposal. Does not send it.", false, true, (input) =>
    run(input, (ctx) => createSowRecord(ctx, input.id || "")),
  );
  add("send_email", "Send a studio email that is not tied to one lead. cc is comma-separated. Set includeSignature true only when the member asks to include their email signature; the saved signature is then added under the message. Do not say it was included unless the result says signatureIncluded. Preview the body first. This sends. attachments is a JSON array of filename, contentType, and contentBase64.", true, true, async (input) => {
    const files = emailFiles(input.attachments);
    if ("error" in files) return result(files);
    return run(input, (ctx) =>
      sendTrackedEmailForContext(ctx, {
        to: input.to || input.email || "",
        cc: input.cc || "",
        subject: input.subject || "",
        body: input.body || "",
        includeSignature: includeEmailSignature(input.includeSignature),
        attachments: files.attachments.map((file) => ({
          filename: file.filename,
          contentType: file.contentType,
          contentBase64: file.content.toString("base64").replace(/=+$/, ""),
        })),
      }),
    );
  });
  add("send_document", "Email the current document version for signature. cc is comma-separated. Refuses while placeholders remain. Marks the document sent only after the email is accepted. Do not claim it was sent or signed unless this result says sent. attachments is a JSON array of filename, contentType, and contentBase64.", true, true, async (input) => {
    const files = emailFiles(input.attachments);
    if ("error" in files) return result(files);
    return run(input, (ctx) =>
      sendDocumentRecord(ctx, {
        id: input.id || "",
        to: input.to || input.email || "",
        subject: input.subject || "",
        message: input.body || "",
        cc: input.cc,
        name: input.name,
        attachments: files.attachments,
      }),
    );
  });
  add("countersign_document", "Add the studio signature after the client has signed. id is the document. name and email are the signer. body is the typed signature. This emails the fully signed PDF. Do not claim it was signed unless the result says ok.", true, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "documents");
      if (blocked) return blocked;
      const versionId = await signedVersionId(ctx, input.id || "");
      if (!versionId) return { error: "This document does not have a client-signed version to countersign." };
      const form = new FormData();
      form.set("signer_name", input.name || "");
      form.set("signer_email", input.email || "");
      form.set("signature_text", input.body || input.name || "");
      form.set("consent", "on");
      return countersignDocumentForContext(ctx, versionId, form);
    }),
  );
  add("send_signed_copy", "Email the signed PDF of a document. id is the document. cc is comma-separated. Sends the certificate once both sides have signed. Do not claim it was sent unless the result says ok.", true, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "documents");
      if (blocked) return blocked;
      const versionId = await signedVersionId(ctx, input.id || "");
      if (!versionId) return { error: "This document does not have a signed version to email." };
      const form = new FormData();
      form.set("to", input.to || input.email || "");
      form.set("cc", input.cc || "");
      form.set("message", input.body || "");
      return emailSignedCopyForContext(ctx, versionId, form);
    }),
  );
  add("create_invoice", "Start a draft invoice for a client. amount is major units for the first line. This does not issue or email it.", false, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "finance");
      if (blocked) return blocked;
      return createDraftInvoiceForContext(ctx, { clientId: input.clientId || "", projectId: input.projectId, description: input.description, amount: input.amount, dueOn: input.dueOn, memo: input.memo });
    }),
  );
  add("add_invoice_line", "Add a line to a draft invoice. amount is the unit price in major units.", false, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "finance");
      if (blocked) return blocked;
      return addInvoiceLineForContext(ctx, input.id || "", { description: input.description || input.title || "", amount: input.amount || input.gross || "" });
    }),
  );
  add("issue_invoice", "Issue a draft invoice, assign its number, and post the charges. If the result says already charged, call again with confirmName confirm only after the member agrees to bill those items again. This does not email it.", true, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "finance");
      if (blocked) return blocked;
      return issueInvoiceForContext(ctx, input.id || "", input.confirmName === "confirm");
    }),
  );
  add("send_invoice", "Email an issued invoice PDF. Marks it sent only after the email is accepted. kind reminder sends a reminder. Do not claim it was sent unless the result says sent.", true, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "finance");
      if (blocked) return blocked;
      return sendInvoiceForContext(ctx, input.id || "", { to: input.to || input.email, message: input.body, reminder: input.kind === "reminder" });
    }),
  );
  add("create_milestone", "Add a milestone to a project. amount is major units. status is planned, in_progress, completed, or cancelled.", false, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "delivery");
      if (blocked) return blocked;
      return createMilestoneForContext(ctx, input.projectId || "", { name: input.name || input.title || "", amount: input.amount, dueOn: input.dueOn, description: input.description || input.body, status: input.status });
    }),
  );
  add("set_milestone_status", "Set a milestone status: planned, in_progress, completed, or cancelled.", false, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "delivery");
      if (blocked) return blocked;
      return setMilestoneStatusForContext(ctx, input.id || "", input.status || "");
    }),
  );
  add("bill_milestone", "Post the milestone amount as a charge and partner earnings. dueOn is the charge date, YYYY-MM-DD. This is billed, not cash received.", true, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "delivery");
      if (blocked) return blocked;
      return billMilestoneForContext(ctx, input.id || "", input.dueOn);
    }),
  );
  add("invite_member", "Invite someone to the studio by email. kind is member, admin, viewer, or partner. Returns emailed true when the invite email went out. Share acceptUrl only when email could not be sent.", true, true, (input) =>
    run(input, (ctx) => inviteMemberForContext(ctx, { email: input.email || input.to || "", role: input.kind, projectId: input.projectId, name: input.name })),
  );
  add("record_settlement", "Record a partner payout. id is the partner. amount is major units. kind is upwork, bank, stripe, or other. This is a settlement, not studio income.", true, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "partners");
      if (blocked) return blocked;
      return recordPartnerSettlementForContext(ctx, { partnerId: input.id || "", amount: input.amount || "", method: input.kind, settledOn: input.dueOn, memo: input.memo, currency: input.currency });
    }),
  );
  add("void_settlement", "Void a posted partner settlement.", true, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "partners");
      if (blocked) return blocked;
      return voidPartnerSettlementForContext(ctx, input.id || "");
    }),
  );
  add("create_partner", "Create a partner. The app still sends the login invite; this tool saves the partner record.", false, true, (input) =>
    run(input, (ctx) => createPartnerRecord(ctx, { name: input.name || "", email: input.email || "", kind: input.kind, notes: input.notes })),
  );
  add("reveal_credential", "Reveal one vault secret. Use this only when the member asked for that credential. Other tools never include the secret.", true, true, (input) =>
    run(input, (ctx) => revealCredentialRecord(ctx, input.id || "")),
  );
}
