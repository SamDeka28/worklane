"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus, FileText } from "lucide-react";
import { toast } from "sonner";
import { StatusChip } from "@/components/studio/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createDocumentAction } from "@/modules/documents/actions";
import { DOCUMENT_TEMPLATES } from "@/modules/documents/templates";
import { DOCUMENT_KIND_SHORT, asDocumentKind } from "@/modules/documents/types";
import { shareRequest } from "@/lib/share-request";
import { listLeadDocumentsAction, type LeadDocumentRow } from "@/modules/crm/follow-actions";

const STATUS_TONE: Record<string, "planning" | "due" | "paid" | "cancelled" | "partial"> = {
  draft: "planning",
  sent: "due",
  accepted: "paid",
  signed: "paid",
  void: "cancelled",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  signed: "Signed",
  void: "Void",
};

const SALES_TEMPLATES = DOCUMENT_TEMPLATES.filter((template) =>
  ["proposal", "sow", "contract", "nda"].includes(template.kind),
);

export function LeadDocuments({
  orgSlug,
  leadId,
  leadName,
  canWrite,
  refreshKey,
  onAccepted,
}: {
  orgSlug: string;
  leadId: string;
  leadName: string;
  canWrite: boolean;
  refreshKey: string;
  /** Called when any linked document is accepted or signed. */
  onAccepted?: (accepted: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [docs, setDocs] = useState<LeadDocumentRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(`${leadName} proposal`);
  const [templateId, setTemplateId] = useState(SALES_TEMPLATES[0]?.id ?? "proposal");

  useEffect(() => {
    let cancelled = false;
    void shareRequest(`lead-documents:${orgSlug}:${leadId}:${refreshKey}`, () =>
      listLeadDocumentsAction(orgSlug, leadId),
    ).then((rows) => {
      if (cancelled) return;
      setDocs(rows);
      onAccepted?.(rows.some((row) => row.status === "accepted" || row.status === "signed"));
    });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, leadId, refreshKey, onAccepted]);

  function createDraft() {
    start(async () => {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("template_id", templateId);
      fd.set("lead_id", leadId);
      const result = await createDocumentAction(orgSlug, fd);
      if (result.error || !result.id) {
        toast.error(result.error ?? "Could not create document");
        return;
      }
      toast.success("Draft created");
      router.push(`/${orgSlug}/documents/${result.id}`);
    });
  }

  if (!canWrite && docs?.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Proposals
        </h3>
        {canWrite && !creating ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(true)}>
            <FilePlus />
            New
          </Button>
        ) : null}
      </div>

      {creating ? (
        <div className="grid gap-2.5 rounded-2xl bg-muted/40 p-3 ring-1 ring-foreground/6">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (title.trim() && !pending) createDraft();
            }}
            aria-label="Title"
            className="bg-card"
          />
          <NativeSelect
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            aria-label="Template"
            className="bg-card"
          >
            {SALES_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </NativeSelect>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || !title.trim()}
              onClick={createDraft}
            >
              {pending ? "Creating…" : "Create draft"}
            </Button>
          </div>
        </div>
      ) : null}

      {docs == null ? (
        <span className="block h-10 animate-pulse rounded-xl bg-muted" />
      ) : docs.length === 0 && !creating ? (
        <p className="text-xs text-muted-foreground">
          Draft a proposal from a template. Sending it moves this lead to Proposal.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {docs.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/${orgSlug}/documents/${doc.id}`}
                className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/8 transition-colors hover:ring-foreground/16"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {DOCUMENT_KIND_SHORT[asDocumentKind(doc.kind)]}
                </span>
                <StatusChip tone={STATUS_TONE[doc.status] ?? "planning"}>
                  {STATUS_LABEL[doc.status] ?? doc.status}
                </StatusChip>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
