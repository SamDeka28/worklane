import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendLeadEmailForContext } from "@/modules/crm/email-actions";
import type { OrgContext } from "@/modules/identity/org";
import { studioFor } from "@/modules/mcp/reads";
import { WRITE_SCOPE } from "@/modules/mcp/origin";
import {
  addContactRecord,
  archiveClientRecord,
  commentOnTaskRecord,
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
  previewDocumentText,
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
  body: z.string().optional(),
  status: z.string().optional(),
  amount: z.string().optional().describe("Amount in major units, such as 1500."),
  gross: z.string().optional().describe("Charge amount in major units."),
  email: z.string().optional(),
  to: z.string().optional(),
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
};

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

  add("preview_document", "Preview a document template as text before saving it. Does not create a record.", false, false, (input) =>
    run(input, async (ctx) => previewDocumentText({ title: input.title || input.name || "Untitled", templateId: input.templateId, orgName: ctx.org.name })),
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
  add("send_lead_email", "Send an email to an existing lead. Preview the body first. This sends.", true, true, (input) =>
    run(input, (ctx) =>
      sendLeadEmailForContext(ctx, input.leadId || input.id || "", {
        to: input.to || input.email || "",
        cc: "",
        subject: input.subject || "",
        body: input.body || "",
        trackOpens: true,
        includeSignature: true,
        templateId: input.templateId || null,
        replyToId: null,
        followUp: null,
        moveToStage: input.stage || null,
      }),
    ),
  );
  add("create_document", "Create a document from a template and save the first version. Preview it first.", false, true, (input) =>
    run(input, (ctx) => createDocumentRecord(ctx, { title: input.title || input.name || "", templateId: input.templateId, clientId: input.clientId, projectId: input.projectId })),
  );
  add("create_partner", "Create a partner. The app still sends the login invite; this tool saves the partner record.", false, true, (input) =>
    run(input, (ctx) => createPartnerRecord(ctx, { name: input.name || "", email: input.email || "", kind: input.kind, notes: input.notes })),
  );
  add("reveal_credential", "Reveal one vault secret. Use this only when the member asked for that credential. Other tools never include the secret.", true, true, (input) =>
    run(input, (ctx) => revealCredentialRecord(ctx, input.id || "")),
  );
}
