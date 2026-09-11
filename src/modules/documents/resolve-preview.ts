import type { JSONContent } from "@tiptap/core";
import { asDocumentRefType } from "@/modules/documents/refs";
import { moneyLabel } from "@/modules/finance/ledger";
import { formatDay } from "@/modules/finance/presentation";
import { MILESTONE_STATUS_LABEL } from "@/modules/delivery/milestone-life";

export type PreviewClient = {
  id: string;
  name: string;
  kind?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type PreviewProject = {
  id: string;
  name: string;
  status?: string;
  clientName?: string | null;
  startsOn?: string | null;
  dueOn?: string | null;
};

export type PreviewMilestone = {
  id: string;
  name: string;
  status?: string;
  dueOn?: string | null;
  amountMinor?: bigint | number | string | null;
};

export type PreviewTask = {
  id: string;
  title: string;
  status?: string;
  dueOn?: string | null;
};

export type PreviewCatalog = {
  clients: PreviewClient[];
  projects: PreviewProject[];
  milestones: PreviewMilestone[];
  tasks: PreviewTask[];
  currency?: "USD" | "INR";
};

function plain(value: string, marks?: JSONContent["marks"]): JSONContent {
  return marks?.length ? { type: "text", text: value, marks } : { type: "text", text: value };
}

function joinParts(parts: string[], sep = " · "): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(sep);
}

function expandMention(
  attrs: Record<string, unknown> | undefined,
  catalog: PreviewCatalog,
): JSONContent[] {
  const id = String(attrs?.id ?? "").trim();
  const type = asDocumentRefType(String(attrs?.type ?? "").trim());
  const fallbackLabel = String(attrs?.label ?? "").trim() || "Unknown";
  const currency = catalog.currency ?? "USD";

  if (!id || !type) {
    return [plain(fallbackLabel)];
  }

  if (type === "client") {
    const client = catalog.clients.find((c) => c.id === id);
    if (!client) return [plain(fallbackLabel, [{ type: "bold" }])];
    const detail = joinParts([
      client.contactName && client.contactName !== client.name ? client.contactName : "",
      client.email ?? "",
      client.phone ?? "",
    ]);
    const nodes: JSONContent[] = [plain(client.name, [{ type: "bold" }])];
    if (detail) nodes.push(plain(` (${detail})`));
    return nodes;
  }

  if (type === "project") {
    const project = catalog.projects.find((p) => p.id === id);
    if (!project) return [plain(fallbackLabel, [{ type: "bold" }])];
    const detail = joinParts([
      project.clientName ? `Client ${project.clientName}` : "",
      project.status ? project.status.replaceAll("_", " ") : "",
      project.startsOn ? `starts ${formatDay(project.startsOn)}` : "",
      project.dueOn ? `due ${formatDay(project.dueOn)}` : "",
    ]);
    const nodes: JSONContent[] = [plain(project.name, [{ type: "bold" }])];
    if (detail) nodes.push(plain(` — ${detail}`));
    return nodes;
  }

  if (type === "milestone") {
    const milestone = catalog.milestones.find((m) => m.id === id);
    if (!milestone) return [plain(fallbackLabel, [{ type: "bold" }])];
    const status =
      milestone.status && milestone.status in MILESTONE_STATUS_LABEL
        ? MILESTONE_STATUS_LABEL[milestone.status as keyof typeof MILESTONE_STATUS_LABEL]
        : milestone.status?.replaceAll("_", " ");
    const detail = joinParts([
      milestone.amountMinor != null && milestone.amountMinor !== undefined
        ? moneyLabel(
            typeof milestone.amountMinor === "bigint"
              ? milestone.amountMinor
              : BigInt(String(milestone.amountMinor)),
            currency,
          )
        : "",
      milestone.dueOn ? `due ${formatDay(milestone.dueOn)}` : "",
      status ?? "",
    ]);
    const nodes: JSONContent[] = [plain(milestone.name, [{ type: "bold" }])];
    if (detail) nodes.push(plain(` — ${detail}`));
    return nodes;
  }

  if (type === "task") {
    const task = catalog.tasks.find((t) => t.id === id);
    if (!task) return [plain(fallbackLabel, [{ type: "bold" }])];
    const detail = joinParts([
      task.status ? task.status.replaceAll("_", " ") : "",
      task.dueOn ? `due ${formatDay(task.dueOn)}` : "",
    ]);
    const nodes: JSONContent[] = [plain(task.title, [{ type: "bold" }])];
    if (detail) nodes.push(plain(` (${detail})`));
    return nodes;
  }

  return [plain(fallbackLabel)];
}

/** Deep-clone TipTap JSON, replacing mention chips with resolved entity copy for Preview. */
export function resolveDocumentForPreview(
  doc: JSONContent | null | undefined,
  catalog: PreviewCatalog,
): JSONContent {
  const source = doc ?? { type: "doc", content: [{ type: "paragraph" }] };

  function walk(node: JSONContent): JSONContent | JSONContent[] {
    if (node.type === "mention") {
      return expandMention(node.attrs as Record<string, unknown> | undefined, catalog);
    }

    const next: JSONContent = { ...node };
    if (node.attrs) next.attrs = { ...node.attrs };
    if (node.marks) next.marks = [...node.marks];
    if (node.content) {
      const children: JSONContent[] = [];
      for (const child of node.content) {
        const resolved = walk(child);
        if (Array.isArray(resolved)) children.push(...resolved);
        else children.push(resolved);
      }
      next.content = children;
    }
    return next;
  }

  const resolved = walk(source);
  return Array.isArray(resolved) ? { type: "doc", content: resolved } : resolved;
}
