import Link from "next/link";
import { CheckCircle2, Circle, Eye, Link2, Mail, MessageSquare } from "lucide-react";
import {
  FilterChip,
  FilterChips,
  StudioToolbar,
  WorkSurface,
} from "@/components/studio/chrome";
import { EmptyState } from "@/components/studio/empty-state";
import { StatusChip } from "@/components/studio/status-chip";
import { cn } from "@/lib/utils";
import {
  DenseCell,
  DenseListPanel,
  DenseRow,
  IndexBody,
  SummaryStat,
  SummaryStrip,
} from "@/components/studio/index-layout";
import { listClients } from "@/modules/clients/queries";
import { listProjects } from "@/modules/delivery/queries";
import { CreateDocumentDialog } from "@/modules/documents/components/document-forms";
import {
  listDocumentOverview,
  listDocuments,
  type DocumentOverview,
} from "@/modules/documents/queries";
import {
  DOCUMENT_KIND_SHORT,
  DOCUMENT_KINDS,
  type DocumentStatus,
} from "@/modules/documents/types";
import { formatDay } from "@/modules/finance/presentation";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
import { JOURNEY } from "@/shared/journey-copy";

export default async function DocumentsPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/documents">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  requireModuleAccess(ctx, "documents");
  const kind = typeof query.kind === "string" ? query.kind : "all";

  const [documents, clients, projects, overview] = await Promise.all([
    listDocuments(orgSlug),
    listClients(orgSlug),
    listProjects(orgSlug),
    listDocumentOverview(orgSlug),
  ]);

  const filtered =
    kind === "all" ? documents : documents.filter((doc) => doc.kind === kind);
  const base = `/${orgSlug}/documents`;
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const now = new Date().getTime();
  const drafts = documents.filter((d) => d.status === "draft").length;
  const outForSignature = documents.filter((d) => d.status === "sent").length;
  const needsCountersign = documents.filter((d) => {
    const info = overview.get(d.id);
    return info?.clientSigned && !info.studioSigned;
  }).length;
  const openComments = documents.reduce(
    (sum, d) => sum + (overview.get(d.id)?.openFeedback ?? 0),
    0,
  );

  return (
    <WorkSurface>
      <StudioToolbar
        purpose={JOURNEY.documents.purpose}
        actions={
          ctx.canWrite ? (
            <CreateDocumentDialog
              orgSlug={orgSlug}
              defaultOpen={query.new === "1"}
              defaultClientId={
                typeof query.client === "string" ? query.client : undefined
              }
              defaultProjectId={
                typeof query.project === "string" ? query.project : undefined
              }
              clients={clients.map((client) => ({ id: client.id, name: client.name }))}
              projects={projects.map((project) => ({
                id: project.id,
                name: project.name,
                clientId: project.clientId,
              }))}
            />
          ) : null
        }
      />
      <FilterChips className="border-b border-border/40">
        <FilterChip href={`${base}?kind=all`} active={kind === "all"}>
          All
        </FilterChip>
        {DOCUMENT_KINDS.filter(
          (k) => k === "proposal" || k === "sow" || documents.some((d) => d.kind === k),
        ).map((k) => (
          <FilterChip key={k} href={`${base}?kind=${k}`} active={kind === k}>
            {DOCUMENT_KIND_SHORT[k]}
          </FilterChip>
        ))}
      </FilterChips>
      <IndexBody>
        {documents.length > 0 ? (
          <SummaryStrip>
            <SummaryStat
              label="With clients"
              value={String(outForSignature)}
              hint="Sent, not yet signed"
              tone="sky"
            />
            <SummaryStat
              label="Needs your signature"
              value={String(needsCountersign)}
              hint="Client signed; countersign"
              tone={needsCountersign > 0 ? "amber" : "slate"}
            />
            <SummaryStat
              label="Open comments"
              value={String(openComments)}
              hint="Client feedback to address"
              tone={openComments > 0 ? "rose" : "slate"}
            />
            <SummaryStat
              label="Drafts"
              value={String(drafts)}
              hint={`${documents.length} document${documents.length === 1 ? "" : "s"} in total`}
              tone="slate"
            />
          </SummaryStrip>
        ) : null}
        {filtered.length === 0 ? (
          <EmptyState
            fill
            title={JOURNEY.documents.emptyTitle}
            body={JOURNEY.documents.emptyBody}
            actionHref={ctx.canWrite ? `${base}?new=1` : undefined}
            actionLabel={ctx.canWrite ? JOURNEY.documents.primaryCta : undefined}
          />
        ) : (
          <DenseListPanel
            columns={
              <>
                <span className="min-w-0 flex-1">Document</span>
                <span className="hidden w-52 lg:block">Client activity</span>
                <span className="hidden w-28 md:block">Review</span>
                <span className="hidden w-36 md:block">Signatures</span>
                <span className="hidden w-24 text-right sm:block">Status</span>
                <span className="hidden w-24 text-right xl:block">Updated</span>
              </>
            }
            footer="Sent versions are kept as-is. Revisions publish to the client's existing link; both sides sign the same locked copy."
          >
            {filtered.map((doc) => {
              const info = overview.get(doc.id);
              const hierarchy = [
                doc.clientId ? clientName.get(doc.clientId) : null,
                doc.projectId ? projectName.get(doc.projectId) : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <DenseRow key={doc.id}>
                  <DenseCell className="min-w-0 flex-1">
                    <Link href={`${base}/${doc.id}`} className="block min-w-0">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {DOCUMENT_KIND_SHORT[doc.kind]}
                        {info ? ` · v${info.versionNumber}` : ""}
                        {" · "}
                        {hierarchy || "No client linked"}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground lg:hidden">
                        <span>{activityLabel(info, now).text}</span>
                        {info?.openFeedback ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{info.openFeedback} open</span>
                          </>
                        ) : null}
                        <span aria-hidden className="sm:hidden">·</span>
                        <span className="sm:hidden">{STATUS_LABEL[doc.status]}</span>
                      </p>
                    </Link>
                  </DenseCell>
                  <DenseCell width="hidden w-52 lg:block" className="text-xs">
                    <ClientActivity info={info} now={now} />
                  </DenseCell>
                  <DenseCell width="hidden w-28 md:block" className="text-xs">
                    {info?.openFeedback ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-300">
                        <MessageSquare className="size-3" />
                        {info.openFeedback} open
                      </span>
                    ) : info?.lastSend ? (
                      <span className="text-muted-foreground">No open items</span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </DenseCell>
                  <DenseCell width="hidden w-36 md:block" className="text-xs">
                    <SignatureState info={info} status={doc.status} />
                  </DenseCell>
                  <DenseCell align="right" width="hidden w-24 sm:block">
                    <StatusChip tone={STATUS_TONE[doc.status]}>{STATUS_LABEL[doc.status]}</StatusChip>
                  </DenseCell>
                  <DenseCell
                    align="right"
                    width="hidden w-24 xl:block"
                    className="text-xs text-muted-foreground"
                  >
                    {formatDay(doc.updatedAt)}
                  </DenseCell>
                </DenseRow>
              );
            })}
          </DenseListPanel>
        )}
      </IndexBody>
    </WorkSurface>
  );
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  signed: "Signed",
  void: "Void",
};

const STATUS_TONE: Record<DocumentStatus, "active" | "due" | "paid" | "cancelled"> = {
  draft: "active",
  sent: "due",
  accepted: "paid",
  signed: "paid",
  void: "cancelled",
};

function ago(iso: string, now: number) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDay(iso);
}

function activityLabel(info: DocumentOverview | undefined, now: number) {
  const send = info?.lastSend;
  if (!send) return { text: "Not shared yet", tone: "muted" as const };
  if (send.lastViewedAt) return { text: `Viewed ${ago(send.lastViewedAt, now)}`, tone: "good" as const };
  if (send.lastOpenedAt) return { text: `Email opened ${ago(send.lastOpenedAt, now)}`, tone: "good" as const };
  return { text: "Not opened yet", tone: "wait" as const };
}

function ClientActivity({ info, now }: { info: DocumentOverview | undefined; now: number }) {
  const send = info?.lastSend;
  if (!send) return <span className="text-muted-foreground/60">Not shared yet</span>;
  const activity = activityLabel(info, now);
  const who = send.recipientName || send.recipientEmail;
  const others = (info?.recipientCount ?? 1) - 1;
  const DeliveryIcon = send.delivery === "link" ? Link2 : Mail;
  return (
    <div className="min-w-0">
      <p className="flex min-w-0 items-center gap-1.5 text-foreground/90">
        <DeliveryIcon className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate" title={send.recipientEmail}>
          {who}
          {others > 0 ? ` +${others}` : ""}
        </span>
        <span className="shrink-0 text-muted-foreground">· {ago(send.sentAt, now)}</span>
      </p>
      <p
        className={cn(
          "mt-0.5 flex items-center gap-1",
          activity.tone === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        )}
      >
        <Eye className="size-3 shrink-0" />
        {activity.text}
      </p>
    </div>
  );
}

function SignatureState({
  info,
  status,
}: {
  info: DocumentOverview | undefined;
  status: DocumentStatus;
}) {
  const client = Boolean(info?.clientSigned);
  const studio = Boolean(info?.studioSigned);
  if (!client && !studio) {
    return (
      <span className="text-muted-foreground/60">
        {status === "accepted" ? "Accepted, no signatures" : status === "sent" ? "Awaiting client" : "—"}
      </span>
    );
  }
  const label = client && studio ? "Fully signed" : client ? "Countersign needed" : "Awaiting client";
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2.5">
        <SignDot done={client} label="Client" />
        <SignDot done={studio} label="You" />
      </p>
      <p
        className={cn(
          "mt-0.5",
          client && studio
            ? "text-emerald-600 dark:text-emerald-400"
            : client
              ? "font-medium text-amber-700 dark:text-amber-300"
              : "text-muted-foreground",
        )}
      >
        {label}
      </p>
    </div>
  );
}

function SignDot({ done, label }: { done: boolean; label: string }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/70",
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}
