import { notFound } from "next/navigation";
import { WorkSurface } from "@/components/studio/chrome";
import { listClients, listPrimaryContactsForOrg } from "@/modules/clients/queries";
import { listMilestones, listProjects, listTasks } from "@/modules/delivery/queries";
import { DocumentEditor } from "@/modules/documents/components/document-editor";
import {
  getDocument,
  listDocumentRefs,
  listDocumentVersions,
  listSignaturesForVersion,
} from "@/modules/documents/queries";
import { requireOrg } from "@/modules/identity/org";

export default async function DocumentDetailPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/documents/[documentId]">) {
  const { orgSlug, documentId } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  const document = await getDocument(orgSlug, documentId);
  if (!document) notFound();

  const versions = await listDocumentVersions(orgSlug, documentId);
  const versionId =
    typeof query.version === "string" && versions.some((row) => row.id === query.version)
      ? query.version
      : versions[0]?.id;
  const version = versions.find((row) => row.id === versionId) ?? versions[0];
  if (!version) notFound();

  const [signatures, clients, projects, refs, primaryContacts] = await Promise.all([
    listSignaturesForVersion(orgSlug, version.id),
    listClients(orgSlug),
    listProjects(orgSlug),
    listDocumentRefs(orgSlug, documentId),
    listPrimaryContactsForOrg(orgSlug),
  ]);

  const milestones = document.projectId
    ? await listMilestones(orgSlug, document.projectId)
    : [];
  const tasks = document.projectId ? await listTasks(orgSlug, document.projectId) : [];

  const clientName = clients.find((c) => c.id === document.clientId)?.name ?? null;
  const project = projects.find((p) => p.id === document.projectId);
  const currency = project?.currency ?? ctx.org.defaultCurrency;

  return (
    <WorkSurface>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-2 sm:px-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DocumentEditor
            orgSlug={orgSlug}
            document={document}
            version={version}
            versions={versions.map((row) => ({
              id: row.id,
              versionNumber: row.versionNumber,
              status: row.status,
            }))}
            canWrite={ctx.canWrite}
            clients={clients.map((c) => {
              const contact = primaryContacts.get(c.id);
              return {
                id: c.id,
                name: c.name,
                contactName: contact?.name ?? null,
                email: contact?.email ?? null,
                phone: contact?.phone ?? null,
              };
            })}
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              clientId: p.clientId,
              clientName: p.clientName,
              status: p.status,
              startsOn: p.startsOn,
              dueOn: p.dueOn,
              billingMode: p.billingMode,
            }))}
            milestones={milestones.map((m) => ({
              id: m.id,
              name: m.name,
              status: m.status,
              dueOn: m.dueOn,
              amountMinor: m.amountMinor,
            }))}
            tasks={tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              dueOn: t.dueOn,
            }))}
            refs={refs}
            clientName={clientName}
            projectName={project?.name ?? null}
            currency={currency === "INR" ? "INR" : "USD"}
          />
          {signatures.length > 0 ? (
            <div className="mt-6 border-t border-border/40 pt-4">
              <h2 className="text-sm font-medium">Signatures</h2>
              <ul className="mt-2 space-y-1.5">
                {signatures.map((sig) => (
                  <li key={sig.id} className="text-sm text-muted-foreground">
                    {sig.signerName} · {sig.signerEmail} ·{" "}
                    {new Date(sig.signedAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {version.snapshot ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Frozen {String(version.snapshot.frozenAt)} · client{" "}
              {String(version.snapshot.clientName ?? "—")} · project{" "}
              {String(version.snapshot.projectName ?? "—")}
            </p>
          ) : null}
        </div>
      </div>
    </WorkSurface>
  );
}
