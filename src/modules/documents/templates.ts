import type { JSONContent } from "@tiptap/core";
import type { DocumentKind } from "@/modules/documents/types";

export type TemplateMention = {
  id: string;
  label: string;
  type: "client" | "project";
};

const NAVY = "#1e3a5f";
const NAVY_SOFT = "#e8eef6";
const INK = "#1c1917";
const MUTED = "#57534e";

function text(
  value: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    size?: string;
    highlight?: string;
    font?: string;
  },
): JSONContent {
  const marks: NonNullable<JSONContent["marks"]> = [];
  if (opts?.bold) marks.push({ type: "bold" });
  if (opts?.italic) marks.push({ type: "italic" });
  if (opts?.highlight) marks.push({ type: "highlight", attrs: { color: opts.highlight } });
  const style: Record<string, string> = {};
  if (opts?.color) style.color = opts.color;
  if (opts?.size) style.fontSize = opts.size;
  if (opts?.font) style.fontFamily = opts.font;
  if (Object.keys(style).length) marks.push({ type: "textStyle", attrs: style });
  return marks.length ? { type: "text", text: value, marks } : { type: "text", text: value };
}

function mention(ref: TemplateMention): JSONContent {
  return {
    type: "mention",
    attrs: { id: ref.id, label: ref.label, type: ref.type },
  };
}

function paragraph(
  ...parts: JSONContent[]
): JSONContent {
  return { type: "paragraph", attrs: { textAlign: "left" }, content: parts.length ? parts : undefined };
}

function heading(level: 1 | 2 | 3, value: string, color = NAVY): JSONContent {
  return {
    type: "heading",
    attrs: { level, textAlign: "left" },
    content: [text(value, { bold: true, color, size: level === 1 ? "32px" : level === 2 ? "20px" : "16px" })],
  };
}

function bullet(...items: (string | JSONContent[])[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [
        paragraph(
          ...(typeof item === "string" ? [text(item, { color: INK, size: "14px" })] : item),
        ),
      ],
    })),
  };
}

function cell(
  parts: JSONContent[],
  opts?: { header?: boolean; bg?: string; color?: string },
): JSONContent {
  return {
    type: opts?.header ? "tableHeader" : "tableCell",
    attrs: {
      backgroundColor: opts?.bg ?? null,
      color: opts?.color ?? null,
    },
    content: [paragraph(...parts)],
  };
}

function row(cells: JSONContent[]): JSONContent {
  return { type: "tableRow", content: cells };
}

function metaTable(input: {
  client?: TemplateMention | null;
  project?: TemplateMention | null;
  kindLabel: string;
}): JSONContent {
  const clientParts = input.client
    ? [mention(input.client)]
    : [text("Tag a client with @", { italic: true, color: MUTED, size: "13px" })];
  const projectParts = input.project
    ? [mention(input.project)]
    : [text("Tag a project with @", { italic: true, color: MUTED, size: "13px" })];

  return {
    type: "table",
    content: [
      row([
        cell([text("Document", { bold: true, color: "#fff", size: "12px" })], {
          header: true,
          bg: NAVY,
        }),
        cell([text(input.kindLabel, { bold: true, color: INK, size: "13px" })], {
          bg: NAVY_SOFT,
        }),
      ]),
      row([
        cell([text("Client", { bold: true, color: "#fff", size: "12px" })], {
          header: true,
          bg: NAVY,
        }),
        cell(clientParts, { bg: NAVY_SOFT }),
      ]),
      row([
        cell([text("Project", { bold: true, color: "#fff", size: "12px" })], {
          header: true,
          bg: NAVY,
        }),
        cell(projectParts, { bg: NAVY_SOFT }),
      ]),
      row([
        cell([text("Status", { bold: true, color: "#fff", size: "12px" })], {
          header: true,
          bg: NAVY,
        }),
        cell(
          [
            text("Draft", { bold: true, color: INK, size: "13px" }),
            text(" · ready for review", { color: MUTED, size: "13px" }),
          ],
          { bg: NAVY_SOFT },
        ),
      ]),
    ],
  };
}

function sampleMilestonesTable(): JSONContent {
  const head = (label: string) =>
    cell([text(label, { bold: true, color: "#fff", size: "12px" })], {
      header: true,
      bg: NAVY,
    });
  const body = (label: string, opts?: { highlight?: boolean }) =>
    cell(
      [
        text(label, {
          color: INK,
          size: "13px",
          highlight: opts?.highlight ? "#bbf7d0" : undefined,
        }),
      ],
      opts?.highlight ? { bg: "#fff7ed" } : undefined,
    );

  return {
    type: "table",
    content: [
      row([
        head("ID"),
        head("Milestone"),
        head("Status"),
        head("Dates"),
        head("Amount"),
      ]),
      row([
        body("M1"),
        body("Discovery & alignment"),
        body("Planned"),
        body("Week 1–2"),
        body("—"),
      ]),
      row([
        body("M2"),
        body("Build / design"),
        body("In progress", { highlight: true }),
        body("Week 3–6"),
        body("—"),
      ]),
      row([
        body("M3"),
        body("Launch & handoff"),
        body("Planned"),
        body("Week 7–8"),
        body("—"),
      ]),
    ],
  };
}

/** Designed starter TipTap doc — meta table, styled sections, sample schedule. */
export function buildBasicDocumentTemplate(input: {
  kind: DocumentKind;
  title: string;
  client?: TemplateMention | null;
  project?: TemplateMention | null;
}): JSONContent {
  const isSow = input.kind === "sow";
  const kindLabel =
    isSow ? "Statement of Work" : input.kind === "other" ? "Document" : "Proposal";
  const title = input.title.trim() || kindLabel;

  return {
    type: "doc",
    content: [
      paragraph(
        text(kindLabel.toUpperCase(), {
          bold: true,
          color: NAVY,
          size: "11px",
          font: "var(--font-plus-jakarta), ui-sans-serif, system-ui, sans-serif",
        }),
      ),
      heading(1, title),
      paragraph(
        text(
          isSow
            ? "Delivery scope, milestones, and commercial terms for this engagement."
            : "Proposed approach, scope, timeline, and investment — ready to refine with @ tags.",
          { color: MUTED, size: "14px", italic: true },
        ),
      ),
      paragraph(),
      metaTable({
        client: input.client,
        project: input.project,
        kindLabel,
      }),
      paragraph(),
      heading(2, "1. Overview"),
      paragraph(
        text(
          isSow
            ? "Summarize engagement goals, success criteria, and operating assumptions."
            : "Describe the problem, desired outcomes, and why this approach fits.",
          { color: INK, size: "14px" },
        ),
      ),
      heading(2, "2. Scope of work"),
      paragraph(text("Included", { bold: true, color: NAVY, size: "14px" })),
      bullet(
        "Discovery and requirements alignment",
        "Design / build as agreed in this document",
        "Reviews and revisions within the stated round limits",
      ),
      paragraph(text("Out of scope", { bold: true, color: NAVY, size: "14px" })),
      bullet(
        "Work not listed above",
        "Third-party licenses, ads, or hosting unless noted",
        "Ongoing retainers outside the milestones below",
      ),
      heading(2, "3. Delivery milestones"),
      paragraph(
        text("Replace this sample with live data — tag milestones with @ or insert the milestones table from the rail.", {
          color: MUTED,
          size: "13px",
          italic: true,
        }),
      ),
      sampleMilestonesTable(),
      heading(2, isSow ? "4. Fees & payment" : "4. Investment"),
      paragraph(
        text(
          isSow
            ? "Fees follow the milestone schedule. Charges post when a milestone is billed; collect when paid."
            : "Recommended package below. Amounts can sync from project milestones when linked.",
          { color: INK, size: "14px" },
        ),
      ),
      bullet(
        [
          text("Base engagement", { bold: true, size: "14px" }),
          text(" — scope above", { size: "14px", color: MUTED }),
        ],
        [
          text("Payment", { bold: true, size: "14px" }),
          text(" — per milestone or as agreed", { size: "14px", color: MUTED }),
        ],
      ),
      heading(2, "5. Next steps"),
      bullet(
        isSow ? "Confirm scope and kickoff date" : "Review this proposal together",
        isSow ? "Sign to accept these terms" : "Accept to freeze this version",
        "Kick off delivery on the agreed start",
      ),
      paragraph(),
      paragraph(
        text("Questions? Reply on this document or contact your studio lead.", {
          italic: true,
          color: MUTED,
          size: "13px",
        }),
      ),
    ],
  };
}
