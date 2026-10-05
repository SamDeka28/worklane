import {
  block,
  emptyDocument,
  nextBlockId,
  type CompositionDocument,
} from "@/modules/documents/composition/schema";
import { getDocumentTemplate } from "@/modules/documents/templates";

export type CompositionTemplate = {
  id: string;
  version: number;
  kind: string;
  name: string;
  description: string;
  outline: string[];
  build: (input: { title: string; orgName?: string | null; clientName?: string | null; projectName?: string | null }) => CompositionDocument;
};

function shell(
  kind: string,
  templateId: string,
  themeId: string,
  input: { title: string; orgName?: string | null; clientName?: string | null },
  blocks: CompositionDocument["sections"][number]["blocks"],
): CompositionDocument {
  const doc = emptyDocument({ kind, title: input.title, templateId, themeId });
  doc.metadata.client = input.clientName ?? "{{client.name}}";
  doc.metadata.author = input.orgName ?? "{{studio.name}}";
  doc.header = { show: true, text: input.title };
  doc.footer = { show: true, text: `${input.title}` };
  doc.sections = [{ id: nextBlockId("s"), blocks }];
  return doc;
}

function heading(text: string, level = 2) {
  return block("heading", { text, level });
}

export const COMPOSITION_TEMPLATES: CompositionTemplate[] = [
  {
    id: "professional-proposal",
    version: 1,
    kind: "proposal",
    name: "Professional proposal",
    description: "A composed proposal: cover columns, summary, scope table, and signature.",
    outline: ["Cover", "Summary", "Scope", "Timeline", "Pricing", "Acceptance"],
    build: (input) =>
      shell("proposal", "professional-proposal", "ink", input, [
        block("columns", {}, [
          block("stack", {}, [
            heading(input.title, 1),
            block("paragraph", { text: "Prepared for {{client.name}} by {{studio.name}}." }),
          ]),
          block("card", { title: "At a glance", body: "Timeline, investment, and outcome." }),
        ]),
        heading("Summary"),
        block("paragraph", { text: "What the client needs, and the outcome this work delivers." }),
        heading("Scope"),
        block("table", {
          columns: [
            { key: "item", label: "Item" },
            { key: "detail", label: "Detail" },
          ],
          rows: [{ item: "Workstream", detail: "Describe the work" }],
        }),
        block("signature", { left: input.orgName || "Provider", right: "{{client.name}}" }),
      ]),
  },
  {
    id: "professional-sow",
    version: 1,
    kind: "sow",
    name: "Professional statement of work",
    description: "A composed statement of work with scope, deliverables, and signatures.",
    outline: ["Overview", "Scope", "Deliverables", "Commercials", "Signatures"],
    build: (input) =>
      shell("sow", "professional-sow", "professional-blue", input, [
        heading(input.title, 1),
        block("paragraph", { text: "Between {{studio.name}} and {{client.name}}." }),
        heading("Scope"),
        block("paragraph", { text: "Describe the scope." }),
        heading("Deliverables"),
        block("table", {
          columns: [
            { key: "id", label: "ID" },
            { key: "title", label: "Deliverable" },
            { key: "detail", label: "Acceptance" },
          ],
          rows: [{ id: "D1", title: "Deliverable", detail: "Acceptance criteria" }],
        }),
        block("signature", { left: "{{studio.name}}", right: "{{client.name}}" }),
      ]),
  },
  {
    id: "professional-prs",
    version: 1,
    kind: "prs",
    name: "Product requirements",
    description: "A composed requirements document. Signature is not required.",
    outline: ["Summary", "Overview", "Requirements", "Architecture", "Plan"],
    build: (input) =>
      shell("prs", "professional-prs", "professional-blue", input, [
        heading(input.title, 1),
        block("paragraph", { text: input.projectName ? `For ${input.projectName}.` : "Product requirements." }),
        heading("Overview"),
        block("paragraph", { text: "Who it is for, and the outcome it creates." }),
        heading("Requirements"),
        block("table", {
          columns: [
            { key: "id", label: "ID" },
            { key: "title", label: "Requirement" },
            { key: "detail", label: "Description" },
          ],
          rows: [{ id: "R1", title: "Requirement", detail: "What the product does" }],
        }),
        heading("Architecture"),
        block("diagram", {
          layout: "stack",
          nodes: [
            { id: "experience", label: "Experience" },
            { id: "services", label: "Services" },
            { id: "data", label: "Data" },
          ],
          edges: [
            { from: "experience", to: "services" },
            { from: "services", to: "data" },
          ],
        }),
      ]),
  },
  {
    id: "professional-srs",
    version: 1,
    kind: "srs",
    name: "Software requirements",
    description: "A composed software requirements document. Signature is not required.",
    outline: ["Summary", "Requirements", "Data", "Quality", "Plan"],
    build: (input) =>
      shell("srs", "professional-srs", "professional-blue", input, [
        heading(input.title, 1),
        heading("Requirements"),
        block("table", {
          columns: [
            { key: "id", label: "ID" },
            { key: "title", label: "Requirement" },
            { key: "detail", label: "Description" },
          ],
          rows: [{ id: "S1", title: "Requirement", detail: "Behavior" }],
        }),
      ]),
  },
  {
    id: "professional-contract",
    version: 1,
    kind: "contract",
    name: "Professional contract",
    description: "Parties, terms, and a required signature block.",
    outline: ["Parties", "Terms", "Signatures"],
    build: (input) =>
      shell("contract", "professional-contract", "ink", input, [
        heading(input.title, 1),
        block("paragraph", { text: "Between {{studio.name}} and {{client.name}}." }),
        heading("Terms"),
        block("paragraph", { text: "The terms of the agreement." }),
        block("signature", { left: "{{studio.name}}", right: "{{client.name}}" }),
      ]),
  },
  {
    id: "professional-invoice",
    version: 1,
    kind: "invoice",
    name: "Invoice document",
    description: "A client, line items, and totals. This is a document, not a ledger invoice.",
    outline: ["Bill to", "Lines", "Total"],
    build: (input) =>
      shell("invoice", "professional-invoice", "ink", input, [
        heading(input.title, 1),
        block("paragraph", { text: "Bill to {{client.name}}." }),
        block("table", {
          columns: [
            { key: "item", label: "Item" },
            { key: "amount", label: "Amount" },
          ],
          rows: [{ item: "Service", amount: "0" }],
        }),
      ]),
  },
  {
    id: "professional-report",
    version: 1,
    kind: "report",
    name: "Professional report",
    description: "Summary, metrics, findings, and next steps.",
    outline: ["Summary", "Metrics", "Findings", "Next steps"],
    build: (input) =>
      shell("report", "professional-report", "professional-blue", input, [
        heading(input.title, 1),
        block("grid", { columns: 3 }, [
          block("card", { title: "Metric", figure: "0", body: "Caption" }),
          block("card", { title: "Metric", figure: "0", body: "Caption" }),
          block("card", { title: "Metric", figure: "0", body: "Caption" }),
        ]),
        heading("Findings"),
        block("paragraph", { text: "What changed, and what to do next." }),
      ]),
  },
  {
    id: "professional-brief",
    version: 1,
    kind: "brief",
    name: "Project brief",
    description: "Goals, audience, deliverables, and constraints on one page.",
    outline: ["Goals", "Audience", "Deliverables", "Constraints"],
    build: (input) =>
      shell("brief", "professional-brief", "ink", input, [
        heading(input.title, 1),
        block("paragraph", { text: "Prepared for {{client.name}}." }),
        heading("Goals"),
        block("paragraph", { text: "What this work should achieve." }),
        heading("Deliverables"),
        block("bullets", { items: ["Deliverable"] }),
        heading("Constraints"),
        block("paragraph", { text: "Timeline, budget, and what is out of scope." }),
      ]),
  },
  {
    id: "professional-nda",
    version: 1,
    kind: "nda",
    name: "Mutual NDA",
    description: "Parties, confidential information, and signatures.",
    outline: ["Parties", "Confidential information", "Term", "Signatures"],
    build: (input) =>
      shell("nda", "professional-nda", "ink", input, [
        heading(input.title, 1),
        block("paragraph", { text: "Between {{studio.name}} and {{client.name}}." }),
        heading("Confidential information"),
        block("paragraph", { text: "What each side may share, and how it must be kept." }),
        block("signature", { left: "{{studio.name}}", right: "{{client.name}}" }),
      ]),
  },
  {
    id: "professional-change-order",
    version: 1,
    kind: "change_order",
    name: "Change order",
    description: "A scope change, its effect on time and cost, and approval.",
    outline: ["Change", "Impact", "Approval"],
    build: (input) =>
      shell("change_order", "professional-change-order", "ink", input, [
        heading(input.title, 1),
        block("paragraph", { text: "Change requested for {{project.name}}." }),
        block("table", {
          columns: [
            { key: "item", label: "Change" },
            { key: "impact", label: "Impact" },
          ],
          rows: [{ item: "Scope", impact: "Time and cost" }],
        }),
        block("signature", { left: "{{studio.name}}", right: "{{client.name}}" }),
      ]),
  },
  {
    id: "meeting-notes",
    version: 1,
    kind: "other",
    name: "Meeting notes",
    description: "Agenda, decisions, and action items.",
    outline: ["Agenda", "Decisions", "Actions"],
    build: (input) =>
      shell("other", "meeting-notes", "ink", input, [
        heading(input.title, 1),
        heading("Agenda"),
        block("checklist", { items: ["Topic"] }),
        heading("Decisions"),
        block("paragraph", { text: "What was decided." }),
        heading("Actions"),
        block("table", {
          columns: [
            { key: "action", label: "Action" },
            { key: "owner", label: "Owner" },
          ],
          rows: [{ action: "Follow up", owner: "Name" }],
        }),
      ]),
  },
  {
    id: "general",
    version: 1,
    kind: "other",
    name: "General document",
    description: "An empty composition. Add any blocks.",
    outline: [],
    build: (input) => shell("other", "general", "ink", input, [block("paragraph", { text: "" })]),
  },
];

const LEGACY_TEMPLATE: Record<string, string> = {
  proposal: "professional-proposal",
  sow: "professional-sow",
  msa: "professional-contract",
  nda: "professional-nda",
  brief: "professional-brief",
  change_order: "professional-change-order",
  status_report: "professional-report",
  meeting_notes: "meeting-notes",
  blank: "general",
};

/** The composition document to use when a studio template is applied. */
export function compositionForAppliedTemplate(id: string): CompositionTemplate | null {
  return getCompositionTemplate(id) ?? getCompositionTemplate(LEGACY_TEMPLATE[id] ?? "");
}

const BY_KIND: Record<string, string> = {
  prs: "professional-prs",
  srs: "professional-srs",
  invoice: "professional-invoice",
};

export function getCompositionTemplate(id: string | undefined): CompositionTemplate | null {
  if (!id) return null;
  const bare = id.split("@")[0];
  return COMPOSITION_TEMPLATES.find((template) => template.id === bare) ?? null;
}

export function defaultCompositionTemplate(kind: string): CompositionTemplate | null {
  const id = BY_KIND[kind];
  return id ? getCompositionTemplate(id) : null;
}

/**
 * Explicit template id wins. A known TipTap id is left to the legacy path.
 * prs, srs, and invoice never fall through to the proposal template.
 */
export function resolveCompositionChoice(input: { templateId?: string; kind?: string }):
  | { use: "composition"; template: CompositionTemplate }
  | { use: "legacy" }
  | { error: string } {
  if (input.templateId) {
    const composed = getCompositionTemplate(input.templateId);
    if (composed) return { use: "composition", template: composed };
    if (getDocumentTemplate(input.templateId)) return { use: "legacy" };
    return { error: "That document template does not exist." };
  }
  if (input.kind && BY_KIND[input.kind]) {
    const template = defaultCompositionTemplate(input.kind);
    if (!template) return { error: "That document kind does not have a template." };
    return { use: "composition", template };
  }
  return { use: "legacy" };
}
