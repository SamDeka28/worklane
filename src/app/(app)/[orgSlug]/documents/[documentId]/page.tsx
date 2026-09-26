import { notFound } from "next/navigation";
import { WorkSurface } from "@/components/studio/chrome";
import { listClients, listPrimaryContactsForOrg } from "@/modules/clients/queries";
import { listMilestones, listProjects, listTasks } from "@/modules/delivery/queries";
import { DocumentEditor } from "@/modules/documents/components/document-editor";
import {
  getDocument,
  listDocumentFeedback,
  listDocumentRefs,
  listDocumentSends,
  listDocumentVersions,
  listSignaturesForVersion,
} from "@/modules/documents/queries";
import { requireOrg } from "@/modules/identity/org";
import { listClientBillingContacts } from "@/modules/invoices/queries";

export default async function DocumentDetailPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/documents/[documentId]">) {
  const { orgSlug, documentId } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  const [document, versions] = await Promise.all([
    getDocument(orgSlug, documentId),
    listDocumentVersions(orgSlug, documentId),
  ]);
  if (!document) notFound();

  const versionId =
    typeof query.version === "string" && versions.some((row) => row.id === query.version)
      ? query.version
      : versions[0]?.id;
  const version = versions.find((row) => row.id === versionId) ?? versions[0];
  if (!version) notFound();

  const [
    signatures,
    clients,
    projects,
    refs,
    primaryContacts,
    sends,
    clientContacts,
    feedback,
    milestones,
    tasks,
  ] = await Promise.all([
      listSignaturesForVersion(orgSlug, version.id),
      listClients(orgSlug),
      listProjects(orgSlug),
      listDocumentRefs(orgSlug, documentId),
      listPrimaryContactsForOrg(orgSlug),
      ctx.canWrite ? listDocumentSends(orgSlug, documentId) : Promise.resolve([]),
      ctx.canWrite && document.clientId
        ? listClientBillingContacts(orgSlug, document.clientId)
        : Promise.resolve([]),
      listDocumentFeedback(orgSlug, documentId),
      document.projectId ? listMilestones(orgSlug, document.projectId) : Promise.resolve([]),
      document.projectId ? listTasks(orgSlug, document.projectId) : Promise.resolve([]),
    ]);

  const clientName = clients.find((c) => c.id === document.clientId)?.name ?? null;
  const project = projects.find((p) => p.id === document.projectId);
  const currency = project?.currency ?? ctx.org.defaultCurrency;

  return (
    <WorkSurface variant="panel">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2 pt-2 sm:px-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DocumentEditor
            orgSlug={orgSlug}
            orgName={ctx.org.name}
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
            signatures={signatures}
            sends={sends}
            feedback={feedback}
            recipients={clientContacts.flatMap((contact) =>
              contact.email ? [{ name: contact.name, email: contact.email }] : [],
            )}
            senderName={ctx.user.displayName}
            senderEmail={ctx.user.email}
          />
        </div>
      </div>
    </WorkSurface>
  );
}
