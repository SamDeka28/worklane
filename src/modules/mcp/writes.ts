import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendLeadEmailForContext } from "@/modules/crm/email-actions";
import { countersignDocumentForContext, emailSignedCopyForContext } from "@/modules/documents/actions";
import { deleteDocumentAsset, getDocumentAsset, listDocumentAssets, uploadDocumentAsset } from "@/modules/documents/assets";
import { documentBlockGuide } from "@/modules/documents/blocks";
import { previewDocumentsForContext, validateDocumentForContext } from "@/modules/documents/preview";
import { listDocumentTemplates } from "@/modules/documents/structured";
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
import { sendProjectTimesheetForContext } from "@/modules/delivery/timesheet-send";
import { replyDocumentForContext } from "@/modules/documents/reply";
import { readDocumentForContext } from "@/modules/mcp/document-read";
import {
  composeDocumentRecord,
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

const orgField = z.string().optional().describe("Studio slug when you belong to more than one studio.");
const recordId = z.string().describe("Record id.");
const ccField = z.string().optional().describe("CC addresses, separated by commas. Up to 5.");
const attachmentField = z
  .string()
  .optional()
  .describe("JSON array of filename, contentType, and contentBase64. Up to 5 files, 5 MB each.");
const signatureField = z
  .union([z.boolean(), z.string()])
  .optional()
  .describe("True only when the member asks to include their saved email signature.");

const toolShapes: Record<string, z.ZodRawShape> = {
  preview_document: {
    id: z.string().optional().describe("Document id."),
    projectId: z.string().optional(),
    clientId: z.string().optional(),
    title: z.string().optional(),
    templateId: z.string().optional(),
  },
  get_document: { id: recordId },
  get_document_preview_url: { id: recordId },
  validate_document: { id: recordId },
  list_document_templates: {},
  list_document_blocks: {},
  upload_asset: {
    id: recordId.describe("Document id the image belongs to."),
    filename: z.string().describe("File name, such as screen.png."),
    mimeType: z.string().optional().describe("image/png, image/jpeg, image/webp, image/gif, or image/svg+xml."),
    contentType: z.string().optional().describe("Same as mimeType."),
    contentBase64: z.string().describe("Base64 image bytes, up to 4 MB. A data URL is accepted. Do not pass a local file path."),
    alt: z.string().optional().describe("Alt text to copy onto the image block."),
    metadata: z.string().optional().describe("Optional JSON object. Returned with the asset. It is not a fileId."),
  },
  get_asset: {
    id: recordId.describe("fileId returned by upload_asset."),
  },
  list_document_assets: {
    id: recordId.describe("Document id."),
  },
  delete_asset: {
    id: recordId.describe("fileId returned by upload_asset. Deletes that image in this studio only."),
  },
  compose_document: {
    id: recordId,
    content: z.string().describe("JSON array of layout blocks from list_document_blocks: paragraph, heading, bullets, numbered, checklist, quote, divider, image, diagram, table, cover, facts, callout, signatures."),
    placement: z.string().optional().describe("append, start, or replace. append keeps the current document and adds the blocks."),
    title: z.string().optional(),
  },
  create_document: {
    title: z.string().describe("Document title."),
    templateId: z.string().optional().describe("Template id from list_document_templates. Defaults from kind, or proposal."),
    kind: z.string().optional().describe("proposal, sow, prs, contract, nda, brief, change_order, report, or other. general is other. prs uses the product requirements template."),
    data: z.string().optional().describe("JSON. For an SOW, pass deliverables, milestones, roles, and paymentSchedule as arrays of row objects. Do not copy one string into every row. Omit unknown fees and dates."),
    clientId: z.string().optional().describe("Client id. A lead id is not a client."),
    projectId: z.string().optional(),
    leadId: z.string().optional().describe("Lead id. Stored as a lead, and does not create a client."),
    body: z.string().optional().describe("Legacy plain text only. Ignored when templateId, kind, or data is set. Do not use for a proposal or SOW."),
  },
  create_proposal: {
    title: z.string().describe("Document title."),
    templateId: z.string().optional().describe("Defaults to proposal."),
    clientId: z.string().optional(),
    projectId: z.string().optional(),
    data: z.string().optional().describe("JSON object of proposal template fields. Do not invent fees."),
  },
  write_document: {
    id: recordId,
    body: z.string().describe("Replacement document text."),
    title: z.string().optional(),
  },
  fill_document: {
    id: recordId,
    data: z.string().optional().describe("JSON rows: deliverables, milestones, roles, paymentSchedule, workstreams. One string is not copied into every row."),
    body: z.string().optional().describe("JSON object, or one scalar placeholder per line. Do not repeat one deliverable for every row."),
    title: z.string().optional(),
  },
  link_document: {
    id: recordId,
    clientId: z.string().optional().describe("Client id. A lead id is not stored as a client."),
    projectId: z.string().optional().describe("Project id. On a signed document, only if none is set."),
    leadId: z.string().optional().describe("Lead id. If the lead has no client, the document stays unlinked."),
  },
  create_sow: {
    id: z.string().optional().describe("Proposal id, when the SOW should start from that proposal."),
    title: z.string().optional().describe("Document title. Defaults from the proposal or to Statement of work."),
    templateId: z.string().optional().describe("Defaults to sow."),
    clientId: z.string().optional().describe("Client id. Do not pass a lead id here."),
    projectId: z.string().optional(),
    leadId: z.string().optional().describe("Lead id when no client exists yet."),
    data: z.string().optional().describe("JSON rows for deliverables, milestones, roles, workstreams, and paymentSchedule. Omit unknown fees, dates, and the MSA."),
  },
  send_document: {
    id: recordId,
    to: z.string().describe("Client email that receives the signing link."),
    subject: z.string(),
    body: z.string().describe("Message above the signing link."),
    name: z.string().optional().describe("Recipient name."),
    cc: ccField,
    attachments: attachmentField,
  },
  countersign_document: {
    id: recordId,
    name: z.string().describe("Studio signer name."),
    email: z.string().describe("Studio signer email."),
    body: z.string().optional().describe("Typed signature. Defaults to the signer name."),
  },
  send_signed_copy: {
    id: recordId,
    to: z.string().describe("Email that receives the signed PDF."),
    body: z.string().optional().describe("Optional message."),
    cc: ccField,
  },
  reply_document: {
    id: recordId,
    body: z.string().describe("Reply the client will see."),
    sendId: z.string().optional().describe("Which sent email this reply belongs to."),
    emailClient: z.union([z.boolean(), z.string()]).optional().describe("Email the client. Defaults to true."),
  },
  preview_email: {
    to: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().optional(),
  },
  send_lead_email: {
    leadId: z.string().describe("Lead id."),
    to: z.string().describe("Recipient email."),
    subject: z.string(),
    body: z.string(),
    cc: ccField,
    includeSignature: signatureField,
    templateId: z.string().optional(),
    stage: z.string().optional().describe("Move the lead to this stage slug after sending."),
    attachments: attachmentField,
  },
  send_email: {
    to: z.string().describe("Recipient email."),
    subject: z.string(),
    body: z.string(),
    cc: ccField,
    includeSignature: signatureField,
    attachments: attachmentField,
  },
  send_timesheet: {
    projectId: z.string().describe("Project id."),
    dueOn: z.string().describe("Month, YYYY-MM."),
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    cc: ccField,
    attachments: attachmentField,
  },
  send_invoice: {
    id: z.string().describe("Invoice id."),
    to: z.string().optional().describe("Recipient. Defaults to the billed-to email."),
    body: z.string().optional().describe("Message. Defaults to the invoice notes."),
    cc: ccField,
    kind: z.string().optional().describe("reminder to send a payment reminder."),
  },
  preview_invoice: {
    id: z.string().optional(),
    layout: z.string().optional().describe("classic, minimal, bold, modern, elegant, studio, corporate, swiss, edge, letterhead, or ribbon."),
    currency: z.string().optional(),
  },
  create_client: {
    name: z.string(),
    kind: z.string().optional(),
    currency: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
  },
  update_client: {
    id: recordId,
    name: z.string().optional(),
    notes: z.string().optional(),
    kind: z.string().optional(),
    currency: z.string().optional(),
  },
  add_contact: {
    clientId: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  },
  update_client_billing: {
    clientId: z.string(),
    name: z.string(),
    title: z.string().optional().describe("Contact name."),
    email: z.string().optional(),
    phone: z.string().optional(),
    body: z.string().optional().describe("Address."),
    memo: z.string().optional().describe("Tax id."),
  },
  archive_client: { id: recordId },
  delete_client: { id: recordId, confirmName: z.string().describe("Exact client name.") },
  rename_studio: { name: z.string() },
  create_project: {
    name: z.string(),
    clientId: z.string(),
    billingMode: z.string().optional(),
    status: z.string().optional(),
    scope: z.string().optional(),
    amount: z.string().optional().describe("Contracted amount in major units. An agreement, not cash."),
  },
  set_project_status: { id: recordId, status: z.string().describe("planning, active, on_hold, completed, or cancelled.") },
  delete_project: { id: recordId, confirmName: z.string().describe("Exact project name.") },
  create_task: {
    projectId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    status: z.string().optional(),
    dueOn: z.string().optional(),
  },
  update_task: {
    id: recordId,
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    dueOn: z.string().optional(),
  },
  delete_task: { id: recordId },
  comment_on_task: { id: recordId, body: z.string() },
  create_work_log: {
    projectId: z.string(),
    dueOn: z.string().optional().describe("Worked on, YYYY-MM-DD."),
    hours: z.string().describe("Decimal hours, such as 1.5."),
    description: z.string().optional(),
  },
  create_charge: {
    clientId: z.string(),
    projectId: z.string().optional(),
    gross: z.string().describe("Amount in major units. Not cash received."),
    memo: z.string().optional(),
    dueOn: z.string().optional().describe("Charged on, YYYY-MM-DD."),
  },
  record_payment: {
    clientId: z.string(),
    amount: z.string().describe("Amount in major units."),
    kind: z.string().optional().describe("receipt or refund."),
    memo: z.string().optional().describe("Reference."),
  },
  void_charge: { id: recordId },
  void_payment: { id: recordId },
  create_lead: {
    name: z.string(),
    company: z.string().optional(),
    email: z.string().optional(),
    stage: z.string().optional(),
    notes: z.string().optional(),
    amount: z.string().optional().describe("Estimated value in major units. A forecast, not billed."),
  },
  move_lead: { id: recordId, stage: z.string().describe("Stage slug.") },
  log_lead_note: {
    id: recordId,
    body: z.string(),
    kind: z.string().optional().describe("note, call, or meeting."),
  },
  create_invoice: {
    clientId: z.string(),
    projectId: z.string().optional(),
    description: z.string().optional(),
    amount: z.string().optional().describe("First line amount in major units."),
    dueOn: z.string().optional(),
    memo: z.string().optional(),
  },
  add_invoice_line: {
    id: z.string().describe("Invoice id."),
    description: z.string(),
    amount: z.string().describe("Unit price in major units."),
  },
  issue_invoice: {
    id: z.string().describe("Invoice id."),
    confirmName: z.string().optional().describe("Pass confirm only after the member agrees to bill items that were already charged."),
  },
  create_milestone: {
    projectId: z.string(),
    name: z.string(),
    amount: z.string().optional().describe("Amount in major units."),
    dueOn: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional().describe("planned, in_progress, completed, or cancelled."),
  },
  set_milestone_status: { id: recordId, status: z.string().describe("planned, in_progress, completed, or cancelled.") },
  bill_milestone: { id: recordId, dueOn: z.string().optional().describe("Charge date, YYYY-MM-DD.") },
  invite_member: {
    email: z.string(),
    kind: z.string().optional().describe("member, admin, viewer, or partner."),
    projectId: z.string().optional(),
    name: z.string().optional(),
  },
  record_settlement: {
    id: z.string().describe("Partner id."),
    amount: z.string().describe("Amount in major units."),
    kind: z.string().optional().describe("upwork, bank, stripe, or other."),
    dueOn: z.string().optional().describe("Settled on, YYYY-MM-DD."),
    memo: z.string().optional(),
    currency: z.string().optional(),
  },
  void_settlement: { id: recordId },
  create_partner: {
    name: z.string(),
    email: z.string(),
    kind: z.string().optional(),
    notes: z.string().optional(),
  },
  reveal_credential: { id: recordId },
};

const toolTitles: Record<string, string> = {
  send_document: "Send by email",
  countersign_document: "Countersign document",
  send_signed_copy: "Email signed PDF",
  reply_document: "Email the client",
  get_document: "Get document",
  list_document_blocks: "List document blocks",
  upload_asset: "Upload document asset",
  get_asset: "Get document asset",
  list_document_assets: "List document assets",
  delete_asset: "Delete document asset",
  compose_document: "Compose document",
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
  filename?: string;
  mimeType?: string;
  contentType?: string;
  contentBase64?: string;
  alt?: string;
  metadata?: string;
  sendId?: string;
  emailClient?: boolean | string;
  data?: string;
  content?: string;
  placement?: string;
};

function parseAssetMetadata(raw?: string): { value?: unknown } | { error: string } {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { error: "metadata must be a JSON object." };
    return { value: parsed };
  } catch {
    return { error: "metadata must be JSON." };
  }
}

function documentFields(raw?: string): { data: Record<string, unknown> } | { error: string } {
  if (!raw?.trim()) return { data: {} };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "data must be a JSON object. Pass deliverables, milestones, roles, and paymentSchedule as arrays of rows." };
    }
    return { data: parsed as Record<string, unknown> };
  } catch {
    return { error: "data must be JSON." };
  }
}

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

  const pending: {
    name: string;
    description: string;
    destructive: boolean;
    writing: boolean;
    handle: (input: ToolInput) => Promise<{
      content: { type: "text"; text: string }[];
      isError?: boolean;
      _meta?: Record<string, unknown>;
    }>;
  }[] = [];
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
    pending.push({ name, description, destructive, writing, handle });
  };

  add("list_document_templates", "List the studio document templates. Each result includes design, the layout to keep: cover, sections, and tables. Fill that design with data. Do not replace it with Markdown or write_document.", false, false, async () =>
    result({ templates: listDocumentTemplates() }),
  );
  add("list_document_blocks", "Describe the layout blocks the document editor can place: cover, fact grid, table formatting, images, diagrams, callouts, and signature blocks. A diagram is native boxes and lines. Upload the asset first using upload_asset. Use the returned fileId in compose_document image blocks. Do not invent fileIds. Use compose_document with this content. Does not save.", false, false, async () =>
    result(documentBlockGuide()),
  );
  add("upload_asset", "Upload the asset first using upload_asset. Use the returned fileId in compose_document image blocks. Do not invent fileIds. Pass the document id, filename, mimeType, and contentBase64. Returns fileId, filename, mimeType, size, url, width, and height. fileId stays valid after this call. Does not change the document text.", false, true, (input) => {
    const metadata = parseAssetMetadata(input.metadata);
    if ("error" in metadata) return Promise.resolve(result(metadata));
    return run(input, (ctx) =>
      uploadDocumentAsset(ctx, {
        documentId: input.id || "",
        filename: input.filename || "image.png",
        contentType: input.mimeType || input.contentType || "",
        contentBase64: input.contentBase64 || "",
        alt: input.alt,
        metadata: metadata.value,
      }),
    );
  });
  add("get_asset", "Read one uploaded image by fileId. Returns filename, mimeType, size, and a fresh url. Does not change the document.", false, false, (input) =>
    run(input, (ctx) => getDocumentAsset(ctx, input.id || "")),
  );
  add("list_document_assets", "List images uploaded to one document. Each item includes fileId for compose_document. Does not change the document.", false, false, (input) =>
    run(input, (ctx) => listDocumentAssets(ctx, input.id || "")),
  );
  add("delete_asset", "Soft-delete one image in this studio. Pass the fileId from upload_asset. An asset from another studio cannot be deleted.", true, true, (input) =>
    run(input, (ctx) => deleteDocumentAsset(ctx, input.id || "")),
  );
  add("preview_document", "Preview a saved document. Pass id. previewUrl is the current saved document, the same one the editor opens. Without an id this returns the blank template, not a saved document. Does not save or send.", false, false, (input) =>
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
  add("create_document", "Create a draft from an existing template. Call list_document_templates first and follow its design. Pass templateId or kind, and data as JSON that fills that layout. For an SOW, pass deliverables, milestones, roles, workstreams, and paymentSchedule as row objects. Do not copy one string into every row, and do not invent fees or dates. A lead id is not a client. Returns previewUrl for the saved document. Does not send.", false, true, async (input) => {
    const fields = documentFields(input.data);
    if ("error" in fields) return result(fields);
    return run(input, (ctx) =>
      createDocumentRecord(ctx, {
        title: input.title || input.name || "",
        templateId: input.templateId,
        kind: input.kind,
        clientId: input.clientId,
        projectId: input.projectId,
        leadId: input.leadId,
        data: fields.data,
        body: input.body,
      }),
    );
  });
  add("create_proposal", "Create a draft proposal from the proposal template. Follow the design from list_document_templates. Pass data as JSON of that layout's fields. Do not invent fees or replace the layout. Returns previewUrl for the saved document. Does not send.", false, true, async (input) => {
    const fields = documentFields(input.data);
    if ("error" in fields) return result(fields);
    return run(input, (ctx) =>
      createDocumentRecord(ctx, {
        title: input.title || input.name || "Project proposal",
        templateId: input.templateId || "proposal",
        kind: "proposal",
        clientId: input.clientId,
        projectId: input.projectId,
        data: fields.data,
      }),
    );
  });
  add("compose_document", "Place editor blocks into a draft: cover, facts, tables with cell fill and borders, images, diagrams, lists, callouts, and signature blocks. Upload the asset first using upload_asset. Use the returned fileId in compose_document image blocks. Do not invent fileIds. An https src still works. A diagram uses layout row, stack, hub, or timeline, plus nodes and edges. content is the JSON from list_document_blocks. placement append adds them, start puts them first, replace rewrites the draft. Does not send or sign.", false, true, (input) =>
    run(input, (ctx) =>
      composeDocumentRecord(ctx, {
        id: input.id || "",
        content: input.content || input.body || "",
        placement: input.placement,
        title: input.title,
      }),
    ),
  );
  add("write_document", "Legacy plain text. Replaces the designed template with paragraphs and drops tables, images, and layout. Use compose_document for layout, or fill_document for a template. Does not send or sign.", false, true, (input) =>
    run(input, (ctx) => writeDocumentRecord(ctx, { id: input.id || "", body: input.body || "", title: input.title })),
  );
  add("fill_document", "Fill the existing template layout. Follow the design from list_document_templates. data is JSON with deliverables, milestones, roles, workstreams, and paymentSchedule, one object per table row. A single string is not copied into every row. Returns previewUrl for the saved document. Does not send or sign.", false, true, async (input) => {
    const fields = documentFields(input.data);
    if ("error" in fields) return result(fields);
    return run(input, (ctx) =>
      fillDocumentRecord(ctx, {
        id: input.id || "",
        body: input.body || input.notes || "",
        title: input.title,
        data: input.data ? fields.data : undefined,
      }),
    );
  });
  add("get_document", "Read one document: status, version, client, project, previewUrl, validation, sends, and signatures. Does not send or sign.", false, false, (input) =>
    run(input, (ctx) => readDocumentForContext(ctx, input.id || "")),
  );
  add("get_document_preview_url", "Return the preview URL for the saved document the editor opens. Opening it shows that document, not the blank template. Does not send.", false, false, (input) =>
    run(input, (ctx) => validateDocumentForContext(ctx, input.id || "")),
  );
  add("validate_document", "Check a document for unfilled template fields and a missing client, project, or title. Does not invent values and does not send.", false, false, (input) =>
    run(input, (ctx) => validateDocumentForContext(ctx, input.id || "")),
  );
  add("link_document", "Attach a client, project, or lead using their real ids. A lead id is not a client. If the lead has no client, the document stays unlinked and the result says so. On a signed document, only a missing client or project can be set. Does not rewrite a locked version.", false, true, (input) =>
    run(input, (ctx) => linkDocumentRecord(ctx, { id: input.id || "", clientId: input.clientId, projectId: input.projectId, leadId: input.leadId })),
  );
  add("create_sow", "Create a draft statement of work from the SOW template. Follow the design from list_document_templates: cover, info grid, sections 1–11, and the deliverable, milestone, role, and payment tables. Pass those rows as objects. Do not copy one string into every row, and do not invent fees, dates, or an MSA. Pass leadId when the client does not exist yet. Returns previewUrl for the saved document. Does not send.", false, true, async (input) => {
    const fields = documentFields(input.data);
    if ("error" in fields) return result(fields);
    return run(input, (ctx) => {
      if (input.id) return createSowRecord(ctx, input.id, { title: input.title, data: fields.data });
      return createDocumentRecord(ctx, {
        title: input.title || input.name || "Statement of work",
        templateId: input.templateId || "sow",
        kind: "sow",
        clientId: input.clientId,
        projectId: input.projectId,
        leadId: input.leadId,
        data: fields.data,
      });
    });
  });
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
  add("send_document", "Send by email. Attaches the current version PDF from the studio renderer and emails the client a private link so they can sign. cc is comma-separated. Refuses while placeholders remain. Marks it sent only after the email is accepted. Do not claim it was sent or signed unless this result says sent.", true, true, async (input) => {
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
  add("countersign_document", "Add the studio signature after the client has signed. This emails the fully signed PDF. Do not claim it was signed unless the result says ok.", true, true, (input) =>
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
  add("reply_document", "Reply on a document and email the client, including the link they use to review or sign. emailClient defaults to true. Do not claim it was emailed unless the result says emailed.", true, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "documents");
      if (blocked) return blocked;
      return replyDocumentForContext(ctx, input.id || "", {
        sendId: input.sendId,
        body: input.body || "",
        emailClient: input.emailClient === undefined ? true : includeEmailSignature(input.emailClient),
      });
    }),
  );
  add("send_signed_copy", "Email the signed PDF. cc is comma-separated. Sends the certificate once both sides have signed. Do not claim it was sent unless the result says ok.", true, true, (input) =>
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
  add("send_timesheet", "Email a project's timesheet PDF for one month. dueOn is YYYY-MM. cc is comma-separated. Do not claim it was sent unless the result says ok.", true, true, async (input) => {
    const files = emailFiles(input.attachments);
    if ("error" in files) return result(files);
    return run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "delivery");
      if (blocked) return blocked;
      return sendProjectTimesheetForContext(ctx, input.projectId || "", input.dueOn || "", {
        to: input.to || input.email || "",
        cc: input.cc || "",
        subject: input.subject || "",
        body: input.body || "",
        attachments: files.attachments.map((file) => ({
          filename: file.filename,
          contentType: file.contentType,
          contentBase64: file.content.toString("base64").replace(/=+$/, ""),
        })),
      });
    });
  });
  add("send_invoice", "Email an issued invoice PDF. cc is comma-separated. Marks it sent only after the email is accepted. kind reminder sends a reminder. Do not claim it was sent unless the result says sent.", true, true, (input) =>
    run(input, async (ctx) => {
      const blocked = assertWrite(ctx, "finance");
      if (blocked) return blocked;
      return sendInvoiceForContext(ctx, input.id || "", { to: input.to || input.email, cc: input.cc, message: input.body, reminder: input.kind === "reminder" });
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

  const first = [
    "list_document_templates",
    "get_document",
    "preview_document",
    "get_document_preview_url",
    "validate_document",
    "create_document",
    "create_proposal",
    "create_sow",
    "list_document_blocks",
    "upload_asset",
    "get_asset",
    "list_document_assets",
    "delete_asset",
    "compose_document",
    "write_document",
    "fill_document",
    "link_document",
    "send_document",
    "reply_document",
    "countersign_document",
    "send_signed_copy",
    "preview_email",
    "send_lead_email",
    "send_email",
    "send_timesheet",
    "send_invoice",
  ];
  const rank = new Map(first.map((name, index) => [name, index]));
  pending.sort((a, b) => (rank.get(a.name) ?? 100) - (rank.get(b.name) ?? 100));
  for (const tool of pending) {
    server.registerTool(
      tool.name,
      {
        title: toolTitles[tool.name],
        description: tool.description,
        inputSchema: { org: orgField, ...(toolShapes[tool.name] ?? {}) },
        annotations: { readOnlyHint: !tool.writing, destructiveHint: tool.destructive, openWorldHint: false },
        _meta: tool.writing ? writeMeta : readMeta,
      },
      async (input) => {
        if (!reader) return connectRequired(origin);
        if (tool.writing && !canWrite) return writeRequired(origin);
        return tool.handle(input as ToolInput);
      },
    );
  }
}
