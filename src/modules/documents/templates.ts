import type { JSONContent } from "@tiptap/core";
import { DOCUMENT_KIND_LABEL, type DocumentKind } from "@/modules/documents/types";

export type TemplateMention = {
  id: string;
  label: string;
  type: "client" | "project";
};

export type TemplateContext = {
  title: string;
  orgName?: string | null;
  client?: TemplateMention | null;
  project?: TemplateMention | null;
  /** Defaults to today. */
  date?: Date;
};

export type DocumentTemplate = {
  id: string;
  kind: DocumentKind;
  name: string;
  description: string;
  /** Section outline shown in the template gallery. */
  outline: string[];
  build: (ctx: TemplateContext) => JSONContent;
};

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const ACCENT = "#1e40af";
const INK = "#0f172a";
const MUTED = "#64748b";
const BAND = "#f8fafc";
const HEAD_BG = "#f1f5f9";
const COVER_BG = "#0f172a";
const COVER_ACCENT = "#93c5fd";
const COVER_TEXT = "#cbd5e1";
const FILL = "#fef9c3";
const GOOD = "#dcfce7";
const WARN = "#fef3c7";
const BAD = "#fee2e2";

type TextOpts = {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  size?: string;
  highlight?: string;
};

function t(value: string, opts: TextOpts = {}): JSONContent {
  const marks: NonNullable<JSONContent["marks"]> = [];
  if (opts.bold) marks.push({ type: "bold" });
  if (opts.italic) marks.push({ type: "italic" });
  if (opts.highlight) marks.push({ type: "highlight", attrs: { color: opts.highlight } });
  const style: Record<string, string> = {};
  if (opts.color) style.color = opts.color;
  if (opts.size) style.fontSize = opts.size;
  if (Object.keys(style).length) marks.push({ type: "textStyle", attrs: style });
  return marks.length ? { type: "text", text: value, marks } : { type: "text", text: value };
}

/** A fill-in placeholder, highlighted so it's easy to spot and replace. */
function field(label: string): JSONContent {
  return t(`[${label}]`, { highlight: FILL, color: INK });
}

function mention(ref: TemplateMention): JSONContent {
  return { type: "mention", attrs: { id: ref.id, label: ref.label, type: ref.type } };
}

type Inline = string | JSONContent;

function inline(parts: Inline[]): JSONContent[] {
  return parts
    .filter((part) => part !== "")
    .map((part) => (typeof part === "string" ? t(part) : part));
}

function p(...parts: Inline[]): JSONContent {
  const content = inline(parts);
  return { type: "paragraph", content: content.length ? content : undefined };
}

function note(value: string): JSONContent {
  return p(t(value, { italic: true, color: MUTED, size: "13px" }));
}

function spacer(): JSONContent {
  return { type: "paragraph" };
}

function h1(value: string): JSONContent {
  return {
    type: "heading",
    attrs: { level: 1 },
    content: [t(value, { color: INK, size: "32px" })],
  };
}

function section(index: number, value: string): JSONContent {
  return {
    type: "heading",
    attrs: { level: 2 },
    content: [
      t(`${String(index).padStart(2, "0")}  `, { color: ACCENT }),
      t(value, { color: INK }),
    ],
  };
}

function clause(index: number, value: string): JSONContent {
  return {
    type: "heading",
    attrs: { level: 3 },
    content: [t(`${index}. `, { color: ACCENT }), t(value, { color: INK })],
  };
}

function h3(value: string): JSONContent {
  return { type: "heading", attrs: { level: 3 }, content: [t(value, { color: INK })] };
}

function bullets(...items: (Inline | Inline[])[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [p(...(Array.isArray(item) ? item : [item]))],
    })),
  };
}

function numbered(...items: (Inline | Inline[])[]): JSONContent {
  return {
    type: "orderedList",
    attrs: { start: 1 },
    content: items.map((item) => ({
      type: "listItem",
      content: [p(...(Array.isArray(item) ? item : [item]))],
    })),
  };
}

function checklist(...items: string[]): JSONContent {
  return {
    type: "taskList",
    content: items.map((item) => ({
      type: "taskItem",
      attrs: { checked: false },
      content: [p(item)],
    })),
  };
}

function callout(...parts: Inline[]): JSONContent {
  return { type: "blockquote", content: [p(...parts)] };
}

function rule(): JSONContent {
  return { type: "horizontalRule" };
}

type CellOpts = {
  header?: boolean;
  bg?: string;
  border?: "none" | "bottom" | "band";
};

function cell(content: Inline[] | JSONContent[], opts: CellOpts = {}): JSONContent {
  const blocks =
    content.length > 0 && typeof content[0] === "object" && (content[0] as JSONContent).type === "paragraph"
      ? (content as JSONContent[])
      : [p(...(content as Inline[]))];
  return {
    type: opts.header ? "tableHeader" : "tableCell",
    attrs: {
      backgroundColor: opts.bg ?? null,
      borderStyle: opts.border ?? null,
    },
    content: blocks,
  };
}

function tr(cells: JSONContent[]): JSONContent {
  return { type: "tableRow", content: cells };
}

/** Data table with a tinted header row. `null` cells render an empty placeholder. */
function table(headers: string[], rows: (Inline | Inline[] | null)[][], opts?: { totalRow?: Inline[] }): JSONContent {
  const head = tr(
    headers.map((label) =>
      cell([t(label.toUpperCase(), { bold: true, color: "#334155", size: "11px" })], {
        header: true,
        bg: HEAD_BG,
      }),
    ),
  );
  const body = rows.map((row) =>
    tr(row.map((value) => cell(value === null ? [] : Array.isArray(value) ? value : [value]))),
  );
  const total = opts?.totalRow
    ? [
        tr(
          opts.totalRow.map((value) =>
            cell(
              value === "" ? [] : [typeof value === "string" ? t(value, { bold: true, color: INK }) : value],
              { bg: BAND },
            ),
          ),
        ),
      ]
    : [];
  return { type: "table", content: [head, ...body, ...total] };
}

/** Key facts under the cover: three columns, each a small label above its value. */
function infoGrid(pairs: [string, Inline | Inline[]][]): JSONContent {
  const rows: JSONContent[] = [];
  for (let index = 0; index < pairs.length; index += 3) {
    const chunk = pairs.slice(index, index + 3);
    const cells = chunk.map(([label, value]) =>
      cell(
        [
          p(t(label.toUpperCase(), { bold: true, color: MUTED, size: "10px" })),
          p(...(Array.isArray(value) ? value : [value]).map((part) =>
            typeof part === "string" ? t(part, { bold: true, color: INK }) : part,
          )),
        ],
        { bg: BAND, border: "none" },
      ),
    );
    while (cells.length < 3) cells.push(cell([], { bg: BAND, border: "none" }));
    rows.push(tr(cells));
  }
  return { type: "table", content: rows };
}

/** Two-party signature block with ruled lines. */
function signatures(left: { role: string; party: Inline }, right: { role: string; party: Inline }): JSONContent {
  const none = (content: Inline[]) => cell(content, { border: "none" });
  const line = (label: string) =>
    tr([
      cell([t(`${label}: `, { color: MUTED, size: "12px" })], { border: "bottom" }),
      cell([], { border: "none" }),
      cell([t(`${label}: `, { color: MUTED, size: "12px" })], { border: "bottom" }),
    ]);
  return {
    type: "table",
    content: [
      tr([
        none([t(left.role.toUpperCase(), { bold: true, color: ACCENT, size: "11px" })]),
        none([]),
        none([t(right.role.toUpperCase(), { bold: true, color: ACCENT, size: "11px" })]),
      ]),
      tr([none([typeof left.party === "string" ? t(left.party, { bold: true }) : left.party]), none([]), none([typeof right.party === "string" ? t(right.party, { bold: true }) : right.party])]),
      tr([
        cell([p(), p()], { border: "bottom" }),
        cell([], { border: "none" }),
        cell([p(), p()], { border: "bottom" }),
      ]),
      tr([
        none([t("Signature", { color: MUTED, size: "12px" })]),
        none([]),
        none([t("Signature", { color: MUTED, size: "12px" })]),
      ]),
      line("Name"),
      line("Title"),
      line("Date"),
    ],
  };
}

function doc(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parties(ctx: TemplateContext) {
  const date = ctx.date ?? new Date();
  return {
    date,
    today: formatDate(date),
    org: ctx.orgName?.trim() || "[Your company]",
    orgInline: ctx.orgName?.trim() ? t(ctx.orgName.trim(), { bold: true }) : field("Your company"),
    client: ctx.client ? mention(ctx.client) : field("Client name"),
    project: ctx.project ? mention(ctx.project) : field("Project name"),
  };
}

/** Dark full-width title band: document type, title and a one-line subtitle. */
function cover(kind: string, ctx: TemplateContext, subtitle: Inline[]): JSONContent[] {
  const onDark = subtitle.map((part) => {
    if (typeof part === "string") return t(part, { color: COVER_TEXT });
    if (part.type === "mention") {
      return t(String(part.attrs?.label ?? ""), { bold: true, color: "#ffffff" });
    }
    if (part.type === "text" && !part.marks?.some((mark) => mark.type === "highlight")) {
      return t(part.text ?? "", { bold: true, color: "#ffffff" });
    }
    return part;
  });
  const band = cell(
    [
      p(t(kind.toUpperCase(), { bold: true, color: COVER_ACCENT, size: "11px" })),
      {
        type: "heading",
        attrs: { level: 1 },
        content: [t(ctx.title.trim() || kind, { color: "#ffffff", size: "32px" })],
      },
      p(...onDark),
    ],
    { bg: COVER_BG, border: "band" },
  );
  return [{ type: "table", content: [tr([band])] }];
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function proposal(ctx: TemplateContext): JSONContent {
  const x = parties(ctx);
  return doc(
    ...cover("Proposal", ctx, ["Prepared for ", x.client, " by ", x.orgInline]),
    infoGrid([
      ["Prepared for", x.client],
      ["Prepared by", x.orgInline],
      ["Date", x.today],
      ["Valid until", formatDate(addDays(x.date, 30))],
      ["Project", x.project],
      ["Reference", field("PRO-001")],
    ]),
    spacer(),
    section(1, "Executive summary"),
    p(
      "Thank you for the opportunity to propose on ",
      x.project,
      ". In one or two short paragraphs, summarise the client's situation, the outcome you will deliver, and why your approach is the right fit.",
    ),
    callout(
      t("At a glance: ", { bold: true }),
      field("timeline, e.g. 8 weeks"),
      " · ",
      field("investment, e.g. $24,000"),
      " · ",
      field("primary outcome"),
    ),
    section(2, "Understanding your needs"),
    h3("Background"),
    p(field("What the client does today and what prompted this project.")),
    h3("Goals"),
    bullets(field("Business goal, e.g. increase qualified leads by 30%"), field("User goal"), field("Operational goal")),
    h3("Challenges"),
    bullets(field("Current pain point"), field("Constraint or risk to manage")),
    section(3, "Our approach"),
    p("We run the engagement in clear phases, each ending with a review so you stay in control of direction and budget."),
    table(
      ["Phase", "What we do", "What you get"],
      [
        [t("1. Discover", { bold: true }), "Stakeholder interviews, audit, research", "Findings and a prioritised plan"],
        [t("2. Design", { bold: true }), "Concepts, prototypes, iterations", "Approved designs"],
        [t("3. Build", { bold: true }), "Development, content, QA", "Production-ready release"],
        [t("4. Launch", { bold: true }), "Go-live, training, handover", "Live product and documentation"],
      ],
    ),
    section(4, "Scope & deliverables"),
    table(
      ["Deliverable", "Description", "Qty"],
      [
        [field("Deliverable"), field("What is included"), "1"],
        [field("Deliverable"), field("What is included"), "1"],
        [field("Deliverable"), field("What is included"), "1"],
      ],
    ),
    h3("Not included"),
    bullets("Work not listed in the table above", "Third-party licences, hosting and paid media unless stated", "Ongoing support after the warranty period"),
    section(5, "Timeline"),
    note("Tip: link a project and use Insert → Milestones table to pull live dates and amounts."),
    table(
      ["Milestone", "Duration", "Target date"],
      [
        ["Kickoff", "Week 1", field("Date")],
        ["Discovery complete", "Weeks 1–2", field("Date")],
        ["Design approved", "Weeks 3–4", field("Date")],
        ["Launch", "Weeks 5–8", field("Date")],
      ],
    ),
    section(6, "Investment"),
    table(
      ["Item", "Qty", "Rate", "Amount"],
      [
        [field("Service"), "1", field("$0"), field("$0")],
        [field("Service"), "1", field("$0"), field("$0")],
      ],
      { totalRow: ["Total (excl. tax)", "", "", field("$0")] },
    ),
    h3("Payment schedule"),
    bullets(
      [t("40%", { bold: true }), " on signature, to reserve the team"],
      [t("40%", { bold: true }), " on design approval"],
      [t("20%", { bold: true }), " on launch"],
    ),
    h3("Optional add-ons"),
    table(["Add-on", "Description", "Price"], [[field("Add-on"), field("Description"), field("$0")]]),
    section(7, `Why ${x.org}`),
    bullets(
      [t("Relevant experience: ", { bold: true }), field("similar projects or industries")],
      [t("Dedicated team: ", { bold: true }), field("who will work on this and their roles")],
      [t("Proven results: ", { bold: true }), field("a measurable outcome from past work")],
    ),
    section(8, "Assumptions"),
    bullets(
      "Timely feedback within 3 business days of each review",
      "The client provides content, brand assets and system access before kickoff",
      "Up to two rounds of revisions per deliverable",
    ),
    section(9, "Terms"),
    p(
      "This proposal is valid for 30 days. Invoices are payable within 15 days. Intellectual property in the final deliverables transfers to the client on payment in full. Both parties keep each other's confidential information private. Full terms are set out in the services agreement or statement of work that follows acceptance.",
    ),
    section(10, "Next steps"),
    numbered("Review this proposal and share any questions", "Sign below to accept", "We send the statement of work and first invoice", "Kickoff within 5 business days"),
    rule(),
    h3("Acceptance"),
    p("By signing below, the client accepts this proposal, including the scope, investment and terms described above."),
    signatures({ role: "Service provider", party: x.orgInline }, { role: "Client", party: x.client }),
  );
}

function sow(ctx: TemplateContext): JSONContent {
  const x = parties(ctx);
  return doc(
    ...cover("Statement of work", ctx, ["Between ", x.orgInline, " and ", x.client]),
    infoGrid([
      ["Client", x.client],
      ["Service provider", x.orgInline],
      ["SOW number", field("SOW-001")],
      ["Effective date", x.today],
      ["Project", x.project],
      ["Governing agreement", field("MSA dated …")],
    ]),
    spacer(),
    section(1, "Purpose"),
    p(
      "This Statement of Work (\u201cSOW\u201d) is entered into under, and governed by, the ",
      field("Master Services Agreement"),
      " between ",
      x.orgInline,
      " (\u201cProvider\u201d) and ",
      x.client,
      " (\u201cClient\u201d). If this SOW conflicts with the agreement, the agreement prevails unless this SOW expressly says otherwise.",
    ),
    section(2, "Background & objectives"),
    p(field("Business context and why the work is needed.")),
    bullets(field("Objective 1"), field("Objective 2"), field("Objective 3")),
    section(3, "Scope of services"),
    p("Provider will perform the following services:"),
    numbered(field("Service or workstream"), field("Service or workstream"), field("Service or workstream")),
    h3("Out of scope"),
    bullets("Anything not described in this section", "Content creation, translation or copywriting unless listed", "Hosting, licences and third-party fees"),
    section(4, "Deliverables & acceptance criteria"),
    table(
      ["#", "Deliverable", "Acceptance criteria", "Due"],
      [
        ["D1", field("Deliverable"), field("Measurable criteria"), field("Date")],
        ["D2", field("Deliverable"), field("Measurable criteria"), field("Date")],
        ["D3", field("Deliverable"), field("Measurable criteria"), field("Date")],
      ],
    ),
    section(5, "Timeline & milestones"),
    note("Tip: link the project and use Insert → Milestones table to keep this in sync."),
    table(
      ["ID", "Milestone", "Start", "End"],
      [
        ["M1", "Discovery & planning", field("Date"), field("Date")],
        ["M2", "Design / build", field("Date"), field("Date")],
        ["M3", "Testing & launch", field("Date"), field("Date")],
      ],
    ),
    section(6, "Roles & responsibilities"),
    table(
      ["Role", "Name", "Responsibilities"],
      [
        ["Provider project lead", field("Name"), "Day-to-day delivery, status reporting, risk management"],
        ["Client sponsor", field("Name"), "Budget owner, final escalation point"],
        ["Client approver", field("Name"), "Reviews and approves deliverables"],
      ],
    ),
    h3("Client responsibilities"),
    bullets("Provide timely access to people, systems and information", "Consolidate feedback and respond within 3 business days", "Supply content and brand assets by the agreed dates"),
    section(7, "Fees & payment schedule"),
    p("Pricing model: ", field("Fixed fee / Time & materials at $X per hour"), "."),
    table(
      ["Milestone", "%", "Amount", "Invoiced on"],
      [
        ["Signature", "30%", field("$0"), "Execution of this SOW"],
        ["M2 complete", "40%", field("$0"), "Acceptance of M2 deliverables"],
        ["M3 complete", "30%", field("$0"), "Launch"],
      ],
      { totalRow: ["Total", "100%", field("$0"), ""] },
    ),
    bullets(
      "Invoices are payable within 15 days of the invoice date",
      "Pre-approved expenses are billed at cost",
      "Late payments may pause work until the account is current",
    ),
    section(8, "Assumptions & dependencies"),
    bullets(field("Assumption"), field("Dependency on the client or a third party")),
    section(9, "Change management"),
    p(
      "Either party may request a change to scope, timeline or fees. Provider will assess the impact and issue a written change order. No change is binding until both parties sign the change order.",
    ),
    section(10, "Acceptance"),
    p(
      "Client will review each deliverable within 5 business days of delivery and either accept it or give written notice of specific non-conformities with the acceptance criteria. Provider will correct them and resubmit. A deliverable is deemed accepted if no notice is given within the review period, or when it is used in production.",
    ),
    section(11, "Term & termination"),
    p(
      "This SOW starts on the effective date and continues until all deliverables are accepted, unless terminated earlier under the governing agreement. On termination, Client pays for services performed and expenses incurred up to the termination date.",
    ),
    rule(),
    p("Agreed and accepted by the authorised representatives of each party:"),
    signatures({ role: "Provider", party: x.orgInline }, { role: "Client", party: x.client }),
  );
}

function contract(ctx: TemplateContext): JSONContent {
  const x = parties(ctx);
  return doc(
    ...cover("Services agreement", ctx, ["Master services agreement between ", x.orgInline, " and ", x.client]),
    callout(
      t("Template notice: ", { bold: true }),
      "this agreement is a general starting point and is not legal advice. Have it reviewed by qualified counsel in your jurisdiction before use.",
    ),
    p(
      "This Master Services Agreement (the \u201cAgreement\u201d) is made on ",
      x.today,
      " (the \u201cEffective Date\u201d) between ",
      x.orgInline,
      ", ",
      field("registered address"),
      " (\u201cProvider\u201d), and ",
      x.client,
      ", ",
      field("registered address"),
      " (\u201cClient\u201d). Each is a \u201cParty\u201d and together the \u201cParties\u201d.",
    ),
    clause(1, "Definitions"),
    p(t("1.1 ", { bold: true }), "\u201cServices\u201d means the services described in a Statement of Work."),
    p(t("1.2 ", { bold: true }), "\u201cStatement of Work\u201d or \u201cSOW\u201d means a document signed by both Parties that describes specific Services, Deliverables, fees and timelines and references this Agreement."),
    p(t("1.3 ", { bold: true }), "\u201cDeliverables\u201d means the work product Provider delivers to Client under a SOW."),
    p(t("1.4 ", { bold: true }), "\u201cConfidential Information\u201d has the meaning given in clause 7."),
    clause(2, "Services and statements of work"),
    p(t("2.1 ", { bold: true }), "Provider will perform the Services described in each SOW with reasonable skill, care and diligence."),
    p(t("2.2 ", { bold: true }), "Each SOW forms part of this Agreement. If a SOW conflicts with this Agreement, this Agreement prevails unless the SOW expressly overrides a specific clause."),
    p(t("2.3 ", { bold: true }), "Changes to a SOW must be agreed in a written change order signed by both Parties."),
    clause(3, "Term"),
    p("This Agreement starts on the Effective Date and continues for ", field("12 months"), ", renewing automatically for successive 12-month periods unless either Party gives 30 days' written notice before renewal. Any SOW in progress continues to be governed by this Agreement until completed or terminated."),
    clause(4, "Fees, invoicing and payment"),
    p(t("4.1 ", { bold: true }), "Client will pay the fees set out in each SOW. Fees exclude applicable taxes, which Client will pay."),
    p(t("4.2 ", { bold: true }), "Invoices are payable within ", field("15"), " days of the invoice date in the currency stated on the invoice."),
    p(t("4.3 ", { bold: true }), "Overdue amounts may accrue interest at ", field("1.5%"), " per month or the maximum permitted by law, whichever is lower. Provider may suspend Services on 7 days' written notice while amounts remain overdue."),
    p(t("4.4 ", { bold: true }), "Pre-approved, reasonable expenses are reimbursed at cost."),
    clause(5, "Client obligations"),
    p("Client will provide timely access to personnel, information, materials and systems reasonably required, and is responsible for the accuracy of content it supplies. Provider is not liable for delays caused by Client's failure to meet these obligations."),
    clause(6, "Intellectual property"),
    p(t("6.1 ", { bold: true }), "On receipt of full payment for a Deliverable, Provider assigns to Client all rights in that Deliverable, excluding Provider Materials."),
    p(t("6.2 ", { bold: true }), "\u201cProvider Materials\u201d means tools, code libraries, know-how and materials owned or licensed by Provider before or independently of this Agreement. Provider grants Client a non-exclusive, perpetual, royalty-free licence to use Provider Materials incorporated into the Deliverables."),
    p(t("6.3 ", { bold: true }), "Provider may display non-confidential Deliverables in its portfolio unless Client objects in writing."),
    clause(7, "Confidentiality"),
    p("Each Party will keep the other's non-public business, technical and financial information confidential, use it only to perform this Agreement, and protect it with at least reasonable care. This obligation does not apply to information that is public through no fault of the receiving Party, already known to it, independently developed, or lawfully received from a third party. These obligations survive for 3 years after termination."),
    clause(8, "Warranties"),
    p("Provider warrants that the Services will be performed in a professional manner consistent with industry standards and that Deliverables will materially conform to the SOW for ", field("30"), " days after acceptance. Provider's sole obligation for breach of this warranty is to re-perform the non-conforming Services. Except as stated in this Agreement, all other warranties are excluded to the extent permitted by law."),
    clause(9, "Limitation of liability"),
    p("Neither Party is liable for indirect, incidental, special or consequential damages, or for loss of profits, revenue or data. Each Party's total liability under this Agreement is limited to the fees paid or payable under the relevant SOW in the 12 months before the claim. These limits do not apply to breach of confidentiality, indemnification obligations, or liability that cannot be limited by law."),
    clause(10, "Indemnification"),
    p("Each Party will defend and indemnify the other against third-party claims arising from its gross negligence, wilful misconduct, or infringement of third-party intellectual property rights by materials it supplied, provided it receives prompt notice and control of the defence."),
    clause(11, "Termination"),
    p(t("11.1 ", { bold: true }), "Either Party may terminate this Agreement or any SOW for convenience on 30 days' written notice."),
    p(t("11.2 ", { bold: true }), "Either Party may terminate immediately if the other materially breaches this Agreement and fails to remedy the breach within 15 days of written notice."),
    p(t("11.3 ", { bold: true }), "On termination, Client pays for Services performed and expenses incurred up to the termination date, and each Party returns or destroys the other's Confidential Information."),
    clause(12, "Non-solicitation"),
    p("During the term and for 12 months afterwards, neither Party will directly solicit for employment any employee of the other who was involved in the Services, without the other's written consent. General job advertisements are not solicitation."),
    clause(13, "Independent contractor"),
    p("Provider is an independent contractor. Nothing in this Agreement creates a partnership, joint venture, employment or agency relationship."),
    clause(14, "Governing law and disputes"),
    p("This Agreement is governed by the laws of ", field("jurisdiction"), ". The Parties will first try to resolve any dispute through good-faith negotiation between senior representatives for 30 days before starting proceedings in the courts of ", field("city, country"), "."),
    clause(15, "General"),
    bullets(
      [t("Entire agreement. ", { bold: true }), "This Agreement and its SOWs are the entire agreement between the Parties on their subject matter."],
      [t("Amendments. ", { bold: true }), "Changes must be in writing and signed by both Parties."],
      [t("Assignment. ", { bold: true }), "Neither Party may assign this Agreement without the other's consent, except to a successor in a merger or sale of substantially all assets."],
      [t("Notices. ", { bold: true }), "Notices must be in writing and sent to the addresses above or by email to the designated contacts."],
      [t("Force majeure. ", { bold: true }), "Neither Party is liable for delay caused by events beyond its reasonable control."],
      [t("Severability. ", { bold: true }), "If any provision is unenforceable, the rest remains in effect."],
      [t("Counterparts. ", { bold: true }), "This Agreement may be signed electronically and in counterparts."],
    ),
    rule(),
    p("Signed by the authorised representatives of the Parties on the dates below."),
    signatures({ role: "Provider", party: x.orgInline }, { role: "Client", party: x.client }),
  );
}

function nda(ctx: TemplateContext): JSONContent {
  const x = parties(ctx);
  return doc(
    ...cover("Mutual non-disclosure agreement", ctx, ["Between ", x.orgInline, " and ", x.client]),
    callout(
      t("Template notice: ", { bold: true }),
      "this NDA is a general starting point and is not legal advice. Have it reviewed by qualified counsel before use.",
    ),
    p(
      "This Mutual Non-Disclosure Agreement (the \u201cAgreement\u201d) is made on ",
      x.today,
      " between ",
      x.orgInline,
      " and ",
      x.client,
      " (each a \u201cParty\u201d). Each Party may disclose Confidential Information to the other (as \u201cDiscloser\u201d) and receive it (as \u201cRecipient\u201d).",
    ),
    clause(1, "Purpose"),
    p("The Parties wish to exchange information to evaluate and carry out ", field("a potential business relationship concerning …"), " (the \u201cPurpose\u201d)."),
    clause(2, "Confidential Information"),
    p("\u201cConfidential Information\u201d means any non-public information disclosed by a Party, in any form, that is marked confidential or would reasonably be understood to be confidential, including business plans, pricing, customer data, designs, source code, and technical information."),
    clause(3, "Exclusions"),
    p("Confidential Information does not include information that the Recipient can show:"),
    bullets(
      "is or becomes public through no fault of the Recipient",
      "was known to the Recipient before disclosure without a duty of confidentiality",
      "is independently developed without use of the Discloser's information",
      "is lawfully received from a third party without restriction",
    ),
    clause(4, "Obligations"),
    p("The Recipient will: (a) use Confidential Information only for the Purpose; (b) not disclose it except to employees, contractors and advisers who need to know it for the Purpose and are bound by confidentiality obligations at least as protective as these; and (c) protect it with at least the degree of care it uses for its own confidential information, and no less than reasonable care."),
    clause(5, "Compelled disclosure"),
    p("If the Recipient is required by law or court order to disclose Confidential Information, it will (where legally permitted) give the Discloser prompt notice and reasonable help to seek a protective order, and disclose only what is legally required."),
    clause(6, "Term"),
    p("This Agreement covers disclosures made within ", field("2 years"), " of the date above. The obligations in it continue for ", field("3 years"), " after the last disclosure, or indefinitely for trade secrets."),
    clause(7, "Return of materials"),
    p("On written request, the Recipient will promptly return or destroy the Discloser's Confidential Information and confirm this in writing, except for copies it must keep by law or in routine backups, which remain subject to this Agreement."),
    clause(8, "No licence or obligation"),
    p("No licence to any intellectual property is granted by this Agreement. Neither Party is obliged to enter into any further agreement. All information is provided \u201cas is\u201d."),
    clause(9, "Remedies"),
    p("Unauthorised disclosure may cause irreparable harm, so the Discloser may seek injunctive relief in addition to any other remedies available at law."),
    clause(10, "General"),
    p("This Agreement is governed by the laws of ", field("jurisdiction"), ". It is the entire agreement on its subject matter, may be amended only in writing signed by both Parties, and may be signed electronically and in counterparts."),
    rule(),
    signatures({ role: "Party A", party: x.orgInline }, { role: "Party B", party: x.client }),
  );
}

function brief(ctx: TemplateContext): JSONContent {
  const x = parties(ctx);
  return doc(
    ...cover("Project brief", ctx, ["The shared starting point for ", x.project]),
    infoGrid([
      ["Client", x.client],
      ["Project", x.project],
      ["Brief owner", field("Name")],
      ["Date", x.today],
      ["Target launch", field("Date")],
      ["Budget", field("$0 – $0")],
    ]),
    spacer(),
    section(1, "Background"),
    p(field("Who the client is, what's happening in their business, and why this project matters now.")),
    section(2, "Objectives & success metrics"),
    table(
      ["Objective", "How we measure it", "Target"],
      [
        [field("Objective"), field("Metric"), field("Target")],
        [field("Objective"), field("Metric"), field("Target")],
      ],
    ),
    section(3, "Target audience"),
    h3("Primary audience"),
    p(field("Who they are, what they need, and what they currently think or do.")),
    h3("Secondary audience"),
    p(field("Other groups we should keep in mind.")),
    section(4, "Key message & tone"),
    callout(t("Single most important message: ", { bold: true }), field("one sentence")),
    bullets([t("Tone of voice: ", { bold: true }), field("e.g. confident, warm, plain-spoken")], [t("Proof points: ", { bold: true }), field("facts that support the message")]),
    section(5, "Deliverables"),
    table(
      ["Deliverable", "Format / specs", "Quantity"],
      [
        [field("Deliverable"), field("Size, format, platform"), "1"],
        [field("Deliverable"), field("Size, format, platform"), "1"],
      ],
    ),
    section(6, "Requirements & constraints"),
    bullets(
      [t("Brand: ", { bold: true }), field("guidelines, logo usage, colours")],
      [t("Technical: ", { bold: true }), field("platforms, integrations, accessibility (WCAG 2.2 AA)")],
      [t("Mandatory: ", { bold: true }), field("legal copy, disclaimers, approvals")],
    ),
    section(7, "Competitors & references"),
    bullets([field("Competitor"), " – what they do well or badly"], [field("Reference"), " – what we like about it"]),
    section(8, "Timeline"),
    table(
      ["Stage", "Date"],
      [
        ["Brief approved", field("Date")],
        ["First concepts", field("Date")],
        ["Final delivery", field("Date")],
      ],
    ),
    section(9, "Stakeholders & approvals"),
    table(
      ["Name", "Role", "Responsibility"],
      [
        [field("Name"), "Sponsor", "Approves budget and final sign-off"],
        [field("Name"), "Project lead", "Day-to-day decisions and feedback"],
        [field("Name"), "Consulted", "Input on specific areas"],
      ],
    ),
    rule(),
    h3("Brief sign-off"),
    p("Approving this brief confirms it accurately reflects the project's goals and requirements."),
    signatures({ role: "Agency", party: x.orgInline }, { role: "Client", party: x.client }),
  );
}

function changeOrder(ctx: TemplateContext): JSONContent {
  const x = parties(ctx);
  return doc(
    ...cover("Change order", ctx, ["Requested change to ", x.project]),
    infoGrid([
      ["Change order no.", field("CO-001")],
      ["Date", x.today],
      ["Project", x.project],
      ["Related SOW", field("SOW-001")],
      ["Requested by", field("Name, company")],
      ["Priority", field("Low / Medium / High")],
    ]),
    spacer(),
    section(1, "Description of change"),
    p(field("Describe exactly what is being added, removed or modified.")),
    section(2, "Reason for change"),
    p(field("Why the change is needed and what happens if it isn't made.")),
    section(3, "Impact assessment"),
    table(
      ["Area", "Current", "Revised", "Impact"],
      [
        [t("Scope", { bold: true }), field("As in SOW"), field("New scope"), field("Summary")],
        [t("Timeline", { bold: true }), field("Original date"), field("New date"), field("+0 days")],
        [t("Cost", { bold: true }), field("$0"), field("$0"), field("+$0")],
        [t("Resources", { bold: true }), field("Current team"), field("Change"), field("Summary")],
      ],
    ),
    section(4, "Cost breakdown"),
    table(
      ["Item", "Hours / Qty", "Rate", "Amount"],
      [[field("Item"), "0", field("$0"), field("$0")]],
      { totalRow: ["Total change", "", "", field("$0")] },
    ),
    p("Billing: ", field("added to the next milestone invoice / invoiced on approval"), "."),
    section(5, "Terms"),
    p(
      "This change order amends the Statement of Work referenced above. All other terms of that SOW and the governing agreement remain unchanged. Work on this change begins only after both parties sign.",
    ),
    rule(),
    signatures({ role: "Provider", party: x.orgInline }, { role: "Client approval", party: x.client }),
  );
}

function statusReport(ctx: TemplateContext): JSONContent {
  const x = parties(ctx);
  const status = (label: string, bg: string) => cell([t(label, { bold: true, color: INK })], { bg });
  return doc(
    ...cover("Status report", ctx, ["Progress update for ", x.project]),
    infoGrid([
      ["Project", x.project],
      ["Client", x.client],
      ["Reporting period", field("Sep 1 – Sep 15")],
      ["Date", x.today],
      ["Prepared by", field("Name")],
      ["Overall status", t("On track", { bold: true, highlight: GOOD })],
    ]),
    spacer(),
    section(1, "Summary"),
    p(field("Two or three sentences on overall progress, the biggest win, and anything the client needs to know.")),
    {
      type: "table",
      content: [
        tr(["Area", "Status", "Notes"].map((label) => cell([t(label, { bold: true, color: INK, size: "12px" })], { header: true, bg: HEAD_BG }))),
        tr([cell([t("Schedule", { bold: true })]), status("On track", GOOD), cell([field("Notes")])]),
        tr([cell([t("Budget", { bold: true })]), status("On track", GOOD), cell([field("Notes")])]),
        tr([cell([t("Scope", { bold: true })]), status("At risk", WARN), cell([field("Notes")])]),
        tr([cell([t("Quality", { bold: true })]), status("On track", GOOD), cell([field("Notes")])]),
      ],
    },
    note("Legend: green = on track · amber = at risk · red = off track, needs action."),
    section(2, "Completed this period"),
    checklist("Completed item", "Completed item", "Completed item"),
    section(3, "Planned next period"),
    bullets(field("Planned item"), field("Planned item")),
    section(4, "Milestones"),
    note("Tip: link the project and use Insert → Milestones table for live status."),
    table(
      ["Milestone", "Due", "Status"],
      [
        [field("Milestone"), field("Date"), "Complete"],
        [field("Milestone"), field("Date"), "In progress"],
        [field("Milestone"), field("Date"), "Not started"],
      ],
    ),
    section(5, "Budget"),
    table(["Budget", "Spent to date", "Remaining", "% used"], [[field("$0"), field("$0"), field("$0"), field("0%")]]),
    section(6, "Risks & issues"),
    {
      type: "table",
      content: [
        tr(["ID", "Description", "Impact", "Owner", "Mitigation"].map((label) => cell([t(label, { bold: true, color: INK, size: "12px" })], { header: true, bg: HEAD_BG }))),
        tr([cell(["R1"]), cell([field("Risk")]), status("High", BAD), cell([field("Owner")]), cell([field("Plan")])]),
        tr([cell(["R2"]), cell([field("Risk")]), status("Medium", WARN), cell([field("Owner")]), cell([field("Plan")])]),
      ],
    },
    section(7, "Decisions needed from you"),
    numbered([field("Decision"), " – needed by ", field("date")]),
  );
}

function meetingNotes(ctx: TemplateContext): JSONContent {
  const x = parties(ctx);
  return doc(
    ...cover("Meeting notes", ctx, [x.project]),
    infoGrid([
      ["Date", x.today],
      ["Time", field("10:00 – 11:00")],
      ["Location", field("Room or video link")],
      ["Facilitator", field("Name")],
      ["Attendees", field("Names")],
      ["Client", x.client],
    ]),
    spacer(),
    section(1, "Agenda"),
    numbered(field("Topic"), field("Topic"), field("Topic")),
    section(2, "Discussion"),
    { type: "heading", attrs: { level: 3 }, content: [field("Topic")] },
    bullets(field("Key point")),
    section(3, "Decisions"),
    table(["Decision", "Made by", "Date"], [[field("Decision"), field("Name"), x.today]]),
    section(4, "Action items"),
    table(
      ["Action", "Owner", "Due"],
      [
        [field("Action"), field("Owner"), field("Date")],
        [field("Action"), field("Owner"), field("Date")],
      ],
    ),
    section(5, "Next meeting"),
    p(field("Date, time and focus")),
  );
}

function blank(ctx: TemplateContext): JSONContent {
  return doc(h1(ctx.title.trim() || "Untitled document"), spacer());
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "proposal",
    kind: "proposal",
    name: "Project proposal",
    description: "Win the work: summary, approach, scope, timeline, investment and acceptance.",
    outline: ["Executive summary", "Needs & goals", "Approach", "Scope & deliverables", "Timeline", "Investment", "Why us", "Terms", "Acceptance"],
    build: proposal,
  },
  {
    id: "sow",
    kind: "sow",
    name: "Statement of work",
    description: "Define exactly what gets delivered, when, by whom, and how it's paid and accepted.",
    outline: ["Purpose", "Objectives", "Scope", "Deliverables & acceptance", "Milestones", "Roles", "Fees & schedule", "Change management", "Signatures"],
    build: sow,
  },
  {
    id: "msa",
    kind: "contract",
    name: "Master services agreement",
    description: "The umbrella contract: payment, IP, confidentiality, liability and termination.",
    outline: ["Definitions", "Services & SOWs", "Term", "Fees & payment", "IP", "Confidentiality", "Warranties", "Liability", "Termination", "General"],
    build: contract,
  },
  {
    id: "nda",
    kind: "nda",
    name: "Mutual NDA",
    description: "Protect confidential information shared by both sides before or during a project.",
    outline: ["Purpose", "Confidential information", "Exclusions", "Obligations", "Term", "Return of materials", "Remedies"],
    build: nda,
  },
  {
    id: "brief",
    kind: "brief",
    name: "Project brief",
    description: "Align on goals, audience, deliverables, constraints and approvals before work starts.",
    outline: ["Background", "Objectives & metrics", "Audience", "Message & tone", "Deliverables", "Constraints", "Timeline", "Stakeholders"],
    build: brief,
  },
  {
    id: "change_order",
    kind: "change_order",
    name: "Change order",
    description: "Document a scope change with its impact on timeline and cost, and get it approved.",
    outline: ["Description", "Reason", "Impact assessment", "Cost breakdown", "Terms", "Approval"],
    build: changeOrder,
  },
  {
    id: "status_report",
    kind: "report",
    name: "Status report",
    description: "Keep clients informed with RAG status, progress, milestones, budget and risks.",
    outline: ["Summary & RAG", "Completed", "Next period", "Milestones", "Budget", "Risks & issues", "Decisions needed"],
    build: statusReport,
  },
  {
    id: "meeting_notes",
    kind: "other",
    name: "Meeting notes",
    description: "Agenda, discussion, decisions and action items with owners and due dates.",
    outline: ["Agenda", "Discussion", "Decisions", "Action items", "Next meeting"],
    build: meetingNotes,
  },
  {
    id: "blank",
    kind: "other",
    name: "Blank document",
    description: "Start from an empty page with just the title.",
    outline: [],
    build: blank,
  },
];

export function getDocumentTemplate(id: string): DocumentTemplate | null {
  return DOCUMENT_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function defaultTemplateForKind(kind: DocumentKind): DocumentTemplate {
  return DOCUMENT_TEMPLATES.find((template) => template.kind === kind) ?? DOCUMENT_TEMPLATES[0];
}

/** Default starter doc for a document kind. */
export function buildBasicDocumentTemplate(input: {
  kind: DocumentKind;
  title: string;
  orgName?: string | null;
  client?: TemplateMention | null;
  project?: TemplateMention | null;
}): JSONContent {
  return defaultTemplateForKind(input.kind).build({
    title: input.title || DOCUMENT_KIND_LABEL[input.kind],
    orgName: input.orgName,
    client: input.client,
    project: input.project,
  });
}
