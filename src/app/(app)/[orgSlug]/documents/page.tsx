import Link from "next/link";
import {
  FilterChip,
  FilterChips,
  StudioToolbar,
  WorkSurface,
} from "@/components/studio/chrome";
import { EmptyState } from "@/components/studio/empty-state";
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
import { listDocuments } from "@/modules/documents/queries";
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

  const [documents, clients, projects] = await Promise.all([
    listDocuments(orgSlug),
    listClients(orgSlug),
    listProjects(orgSlug),
  ]);

  const filtered =
    kind === "all" ? documents : documents.filter((doc) => doc.kind === kind);
  const base = `/${orgSlug}/documents`;
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const proposals = documents.filter((d) => d.kind === "proposal").length;
  const sows = documents.filter((d) => d.kind === "sow").length;
  const drafts = documents.filter((d) => d.status === "draft").length;

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
        <FilterChip href={`${base}?kind=proposal`} active={kind === "proposal"}>
          Proposals
        </FilterChip>
        <FilterChip href={`${base}?kind=sow`} active={kind === "sow"}>
          SOWs
        </FilterChip>
      </FilterChips>
      <IndexBody>
        {documents.length > 0 ? (
          <SummaryStrip>
            <SummaryStat label="Documents" value={String(documents.length)} hint="All kinds" />
            <SummaryStat label="Proposals" value={String(proposals)} tone="sky" />
            <SummaryStat label="SOWs" value={String(sows)} tone="amber" />
            <SummaryStat
              label="Drafts"
              value={String(drafts)}
              hint="Still editable"
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
                <span className="w-24 text-right">Kind</span>
                <span className="w-24 text-right">Status</span>
                <span className="w-28 text-right">Updated</span>
              </>
            }
            footer="Open a document to draft. Accept or sign freezes a permanent copy."
          >
            {filtered.map((doc) => {
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
                        {hierarchy || "No client linked"}
                      </p>
                    </Link>
                  </DenseCell>
                  <DenseCell
                    align="right"
                    width="w-24"
                    className="text-sm capitalize text-muted-foreground"
                  >
                    {doc.kind}
                  </DenseCell>
                  <DenseCell
                    align="right"
                    width="w-24"
                    className="text-sm capitalize text-muted-foreground"
                  >
                    {doc.status}
                  </DenseCell>
                  <DenseCell align="right" width="w-28" className="text-sm text-muted-foreground">
                    {new Date(doc.updatedAt).toLocaleDateString()}
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
