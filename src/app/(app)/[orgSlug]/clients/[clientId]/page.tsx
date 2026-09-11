import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  EntityChrome,
  HubBody,
  HubSection,
  NextStepCard,
  SoftCard,
  WorkSurface,
} from "@/components/studio/chrome";
import {
  DenseCell,
  DenseListPanel,
  DenseRow,
} from "@/components/studio/index-layout";
import { StatusChip } from "@/components/studio/status-chip";
import { AddContactSheet } from "@/modules/clients/components/client-forms";
import { ClientHubChrome } from "@/modules/clients/components/client-hub-chrome";
import { clientNextStep } from "@/modules/clients/next-step";
import { getClient, listClientActivity, listContacts } from "@/modules/clients/queries";
import { listClientProjects } from "@/modules/delivery/queries";
import { CollectComposer } from "@/modules/finance/components/finance-forms";
import { ChargeRows } from "@/modules/finance/components/charge-board";
import { moneyLabel } from "@/modules/finance/ledger";
import { collectTargets } from "@/modules/finance/presentation";
import { loadClientFinance } from "@/modules/finance/queries";
import { requireOrg } from "@/modules/identity/org";
import { CreateDocumentDialog } from "@/modules/documents/components/document-forms";
import { listDocuments } from "@/modules/documents/queries";

export default async function ClientProfilePage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/clients/[clientId]">) {
  const { orgSlug, clientId } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  const client = await getClient(orgSlug, clientId);
  if (!client) notFound();

  const selectedChargeId = typeof query.charge === "string" ? query.charge : undefined;
  const showCollect = query.collect === "1" || Boolean(selectedChargeId);
  const [contacts, activity, finance, projects, documents] = await Promise.all([
    listContacts(orgSlug, clientId),
    listClientActivity(orgSlug, clientId),
    loadClientFinance(orgSlug, clientId),
    listClientProjects(orgSlug, clientId),
    listDocuments(orgSlug).catch(() => []),
  ]);
  const clientDocs = documents.filter((doc) => doc.clientId === clientId);

  const latestProjectId = projects[0]?.id ?? null;
  const next = clientNextStep({
    projectCount: projects.length,
    outstandingMinor: finance.snapshot.outstandingMinor,
    contactCount: contacts.length,
    latestProjectId,
  });
  const base = `/${orgSlug}/clients/${client.id}`;
  const owing = finance.charges.filter(
    (c) => c.status !== "void" && c.outstandingMinor > BigInt(0),
  );
  const early = projects.length === 0 && owing.length === 0 && clientDocs.length === 0;
  const primaryContact = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;

  return (
    <WorkSurface>
      <EntityChrome
        title={client.name}
        meta={
          <>
            <span className="capitalize">{client.kind}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums font-medium text-foreground">
              {moneyLabel(finance.snapshot.outstandingMinor, client.currency)} due
            </span>
            {projects.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {projects.length} project{projects.length === 1 ? "" : "s"}
                </span>
              </>
            ) : null}
          </>
        }
        primaryAction={
          <ClientHubChrome
            orgSlug={orgSlug}
            client={{
              id: client.id,
              name: client.name,
              kind: client.kind,
              notes: client.notes,
              notesDoc: client.notesDoc,
              currency: client.currency,
            }}
            next={next}
            canWrite={ctx.canWrite}
            editOpen={query.edit === "1"}
            contactOpen={query.contact === "1"}
            projectOpen={query.new === "project"}
            chargeOpen={query.new === "charge"}
            attachableDocuments={clientDocs.map((doc) => ({
              id: doc.id,
              title: doc.title,
              kind: doc.kind,
              status: doc.status,
              projectId: doc.projectId,
            }))}
          />
        }
      />

      <HubBody>
        {/* Guidance only — primary CTA lives in EntityChrome */}
        <NextStepCard title={next.title} body={next.body} />

        {early ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <SoftCard className="flex flex-col gap-5 p-5">
              <div>
                <p className="text-sm font-semibold tracking-tight">Who you’re talking to</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Contacts and notes for this engagement.
                </p>
              </div>
              {primaryContact ? (
                <div className="rounded-3xl bg-muted/50 px-4 py-4 ring-1 ring-border/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {primaryContact.name || "Unnamed"}
                        {primaryContact.isPrimary ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            Primary
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[primaryContact.email, primaryContact.phone, primaryContact.whatsapp]
                          .filter(Boolean)
                          .join(" · ") || "Add email or phone so follow-ups aren’t guesswork."}
                      </p>
                    </div>
                    {ctx.canWrite ? (
                      <AddContactSheet orgSlug={orgSlug} clientId={client.id} />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-muted/50 px-4 py-6 text-center ring-1 ring-border/30">
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                  {ctx.canWrite ? (
                    <div className="mt-3 flex justify-center">
                      <AddContactSheet orgSlug={orgSlug} clientId={client.id} />
                    </div>
                  ) : null}
                </div>
              )}
              {contacts.length > 1 ? (
                <ul className="space-y-2">
                  {contacts
                    .filter((c) => c.id !== primaryContact?.id)
                    .map((contact) => (
                      <li
                        key={contact.id}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="font-medium">{contact.name || "Unnamed"}</span>
                        <span className="truncate text-muted-foreground">
                          {[contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : null}
              {client.notes ? (
                <p className="line-clamp-3 text-sm text-muted-foreground">{client.notes}</p>
              ) : null}
            </SoftCard>

            <SoftCard className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-sm font-semibold tracking-tight">Ready when you are</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  After the first project, money and docs show up here.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-muted/40 px-3.5 py-3">
                  <dt className="text-xs text-muted-foreground">Due</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {moneyLabel(finance.snapshot.outstandingMinor, client.currency)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-muted/40 px-3.5 py-3">
                  <dt className="text-xs text-muted-foreground">Collected</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    {moneyLabel(finance.snapshot.collectedMinor, client.currency)}
                  </dd>
                </div>
              </dl>
              {ctx.canWrite ? (
                <ul className="mt-auto space-y-3 border-t border-border/40 pt-4 text-sm">
                  <li>
                    <Link
                      href={`${base}?new=project`}
                      className="font-medium text-sky-800 underline-offset-2 hover:underline"
                    >
                      Start the first project →
                    </Link>
                  </li>
                  <li>
                    <CreateDocumentDialog
                      orgSlug={orgSlug}
                      triggerLabel="Draft a proposal"
                      triggerVariant="outline"
                      defaultClientId={client.id}
                      clients={[{ id: client.id, name: client.name }]}
                      projects={[]}
                    />
                  </li>
                </ul>
              ) : null}
              {activity.length > 0 ? (
                <div className="border-t border-border/40 pt-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Activity
                  </p>
                  <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {activity.slice(0, 4).map((item) => (
                      <li key={item.id} className="flex justify-between gap-2">
                        <span className="capitalize">{item.verb.replaceAll("_", " ")}</span>
                        <span className="shrink-0 text-xs">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </SoftCard>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[1.25rem] bg-muted/40 px-4 py-3 text-sm ring-1 ring-border/30">
              <span>
                <span className="text-muted-foreground">Due </span>
                <span className="font-semibold tabular-nums">
                  {moneyLabel(finance.snapshot.outstandingMinor, client.currency)}
                </span>
              </span>
              <span className="text-border">·</span>
              <span>
                <span className="text-muted-foreground">Collected </span>
                <span className="font-semibold tabular-nums">
                  {moneyLabel(finance.snapshot.collectedMinor, client.currency)}
                </span>
              </span>
              <span className="text-border">·</span>
              <span>
                <span className="text-muted-foreground">Projects </span>
                <span className="font-semibold tabular-nums">{projects.length}</span>
              </span>
              <span className="text-border">·</span>
              <span>
                <span className="text-muted-foreground">Contacts </span>
                <span className="font-semibold tabular-nums">{contacts.length}</span>
              </span>
            </div>

            {projects.length > 0 ? (
              <HubSection
                title="Projects"
                action={
                  ctx.canWrite ? (
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`${base}?new=project`} />}
                    >
                      New
                    </Button>
                  ) : null
                }
              >
                <DenseListPanel>
                  {projects.map((project) => (
                    <DenseRow key={project.id}>
                      <DenseCell className="min-w-0 flex-1">
                        <Link
                          href={`/${orgSlug}/projects/${project.id}`}
                          className="flex min-w-0 flex-col"
                        >
                          <span className="truncate text-sm font-medium">{project.name}</span>
                          <span className="mt-0.5">
                            <StatusChip
                              tone={project.status === "active" ? "active" : "planning"}
                            >
                              {project.status.replaceAll("_", " ")}
                            </StatusChip>
                          </span>
                        </Link>
                      </DenseCell>
                      <DenseCell
                        align="right"
                        width="w-28"
                        className="text-sm text-muted-foreground"
                      >
                        {project.contractedAmountMinor != null
                          ? moneyLabel(project.contractedAmountMinor, project.currency)
                          : project.currency}
                      </DenseCell>
                    </DenseRow>
                  ))}
                </DenseListPanel>
              </HubSection>
            ) : null}

            {(owing.length > 0 ||
              finance.charges.length > 0 ||
              showCollect ||
              next.href === "collect") && (
              <HubSection id="collect" title="Money">
                {owing.length > 0 ? (
                  <ChargeRows
                    orgSlug={orgSlug}
                    charges={owing}
                    canWrite={ctx.canWrite}
                    activeChargeId={selectedChargeId}
                    collectHref={(chargeId) =>
                      `${base}?collect=1&charge=${chargeId}#collect`
                    }
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Caught up on the ledger.</p>
                )}
                {ctx.canWrite && (showCollect || owing.length > 0) ? (
                  <div className="mt-4">
                    <CollectComposer
                      orgSlug={orgSlug}
                      clientId={client.id}
                      targets={collectTargets(finance.charges)}
                      defaultChargeId={selectedChargeId}
                    />
                  </div>
                ) : null}
              </HubSection>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <HubSection
                title="Contacts"
                action={
                  ctx.canWrite ? (
                    <AddContactSheet orgSlug={orgSlug} clientId={client.id} />
                  ) : null
                }
              >
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                ) : (
                  <ul className="divide-y divide-border/40 overflow-hidden rounded-[1.75rem] bg-muted/40 ring-1 ring-border/30">
                    {contacts.map((contact) => (
                      <li key={contact.id} className="px-4 py-3 text-sm">
                        <p className="font-medium">
                          {contact.name || "Unnamed"}
                          {contact.isPrimary ? (
                            <span className="ml-2 text-xs text-muted-foreground">Primary</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {[contact.email, contact.phone, contact.whatsapp]
                            .filter(Boolean)
                            .join(" · ") || "No details"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </HubSection>

              <HubSection
                title="Documents"
                action={
                  ctx.canWrite ? (
                    <CreateDocumentDialog
                      orgSlug={orgSlug}
                      triggerLabel="New"
                      triggerVariant="outline"
                      defaultClientId={client.id}
                      clients={[{ id: client.id, name: client.name }]}
                      projects={projects.map((project) => ({
                        id: project.id,
                        name: project.name,
                        clientId: client.id,
                      }))}
                    />
                  ) : null
                }
              >
                {clientDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Proposals and SOWs land here once you draft one.
                  </p>
                ) : (
                  <DenseListPanel>
                    {clientDocs.slice(0, 8).map((doc) => (
                      <DenseRow key={doc.id}>
                        <DenseCell className="min-w-0 flex-1">
                          <Link
                            href={`/${orgSlug}/documents/${doc.id}`}
                            className="truncate text-sm font-medium hover:underline"
                          >
                            {doc.title}
                          </Link>
                        </DenseCell>
                        <DenseCell
                          align="right"
                          width="w-24"
                          className="text-xs capitalize text-muted-foreground"
                        >
                          {doc.kind}
                        </DenseCell>
                      </DenseRow>
                    ))}
                  </DenseListPanel>
                )}
              </HubSection>
            </div>

            {activity.length > 0 ? (
              <HubSection title="Activity">
                <ol className="space-y-2 text-sm">
                  {activity.slice(0, 8).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-baseline justify-between gap-3 text-muted-foreground"
                    >
                      <span className="capitalize">{item.verb.replaceAll("_", " ")}</span>
                      <span className="shrink-0 text-xs">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ol>
              </HubSection>
            ) : null}
          </>
        )}
      </HubBody>
    </WorkSurface>
  );
}
