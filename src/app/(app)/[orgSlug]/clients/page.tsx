import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AvatarMark, SoftCard, StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { MoneyDonutCard, MoneyMetaCards } from "@/components/studio/money-donut";
import { EmptyState } from "@/components/studio/empty-state";
import {
  DenseCell,
  DenseListPanel,
  DenseRow,
  IndexBody,
  SummaryStat,
  SummaryStrip,
} from "@/components/studio/index-layout";
import { StatusChip } from "@/components/studio/status-chip";
import { CreateClientDialog } from "@/modules/clients/components/client-forms";
import { ClientToolbar } from "@/modules/clients/components/client-toolbar";
import { listClients } from "@/modules/clients/queries";
import { listClientsWithOutstanding, loadOrgFinance } from "@/modules/finance/queries";
import { moneyLabel } from "@/modules/finance/ledger";
import { dueThisMonthMinor } from "@/modules/finance/presentation";
import { listProjectBoard } from "@/modules/delivery/queries";
import { requireOrg } from "@/modules/identity/org";
import { canSeeMoney } from "@/modules/identity/permissions";
import { JOURNEY } from "@/shared/journey-copy";

const PAGE_SIZE = 40;

const zeroSnapshot = {
  outstandingMinor: BigInt(0),
  collectedMinor: BigInt(0),
};

export default async function ClientsPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/clients">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  const seeMoney = canSeeMoney(ctx.permissions);
  const canCollect = ctx.canWrite && seeMoney;
  const q = typeof query.q === "string" ? query.q : "";
  const filter = typeof query.filter === "string" ? query.filter : "";
  const kind = typeof query.kind === "string" ? query.kind : "";
  const view = query.view === "cards" ? "cards" : "list";
  const page = Math.max(1, Number(query.page) || 1);

  const [rows, board, finance] = await Promise.all([
    seeMoney
      ? listClientsWithOutstanding(orgSlug, q)
      : listClients(orgSlug, q).then((clients) =>
          clients.map((client) => ({ client, snapshot: zeroSnapshot })),
        ),
    listProjectBoard(orgSlug),
    seeMoney && view === "cards"
      ? loadOrgFinance(orgSlug)
      : Promise.resolve(null as Awaited<ReturnType<typeof loadOrgFinance>> | null),
  ]);

  const projectCount = new Map<string, number>();
  for (const row of board) {
    projectCount.set(row.project.clientId, (projectCount.get(row.project.clientId) ?? 0) + 1);
  }

  const filtered = rows.filter(({ client, snapshot }) => {
    if (kind && client.kind !== kind) return false;
    if (!seeMoney) return true;
    if (filter === "owing" && snapshot.outstandingMinor <= BigInt(0)) return false;
    if (filter === "settled" && snapshot.outstandingMinor > BigInt(0)) return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const owingCount = seeMoney
    ? rows.filter((r) => r.snapshot.outstandingMinor > BigInt(0)).length
    : 0;
  const totalDue = seeMoney
    ? rows.reduce((sum, r) => sum + r.snapshot.outstandingMinor, BigInt(0))
    : BigInt(0);
  const currency = rows[0]?.client.currency ?? ctx.org.defaultCurrency;
  const activeProjects = board.filter(
    (r) => r.project.status === "active" || r.project.status === "planning",
  ).length;

  return (
    <WorkSurface>
      <StudioToolbar
        purpose={JOURNEY.clients.purpose}
        actions={
          ctx.canWrite ? (
            <CreateClientDialog orgSlug={orgSlug} defaultOpen={query.new === "1"} />
          ) : null
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          fill
          title={q ? "No names match" : JOURNEY.clients.emptyTitle}
          body={q ? undefined : JOURNEY.clients.emptyBody}
          actionHref={ctx.canWrite && !q ? `/${orgSlug}/clients?new=1` : undefined}
          actionLabel={ctx.canWrite && !q ? JOURNEY.clients.primaryCta : undefined}
        />
      ) : (
        <>
          <ClientToolbar
            orgSlug={orgSlug}
            q={q}
            filter={filter}
            kind={kind}
            view={view}
            page={page}
            pageCount={pageCount}
            total={filtered.length}
            seeMoney={seeMoney}
          />
          <IndexBody>
            <SummaryStrip>
              <SummaryStat label="Clients" value={String(rows.length)} hint="Who you bill" />
              {seeMoney ? (
                <>
                  <SummaryStat
                    label="Owing"
                    value={String(owingCount)}
                    hint="Open ledger balance"
                    tone={owingCount ? "rose" : "emerald"}
                  />
                  <SummaryStat
                    label="Due total"
                    value={moneyLabel(totalDue, currency)}
                    hint="Across all clients"
                    tone="sky"
                  />
                </>
              ) : null}
              <SummaryStat
                label="Projects"
                value={String(activeProjects)}
                hint="Active delivery"
                tone="amber"
              />
            </SummaryStrip>

            {visible.length === 0 ? (
              <EmptyState fill title="No clients match these filters" />
            ) : view === "list" ? (
              <DenseListPanel
                columns={
                  seeMoney ? (
                    <>
                      <span className="min-w-0 flex-1">Client</span>
                      <span className="hidden w-24 text-right sm:block">Projects</span>
                      <span className="w-28 text-right">Due</span>
                      <span className="w-28 text-right">Next</span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1">Client</span>
                      <span className="hidden w-24 text-right sm:block">Projects</span>
                      <span className="w-28 text-right">Next</span>
                    </>
                  )
                }
                footer={
                  seeMoney
                    ? owingCount
                      ? "Collect from a row, or open a client to see projects and contacts."
                      : "Everyone is settled — start a project or post the next charge."
                    : "Open a client to see projects and contacts."
                }
              >
                {visible.map(({ client, snapshot }) => {
                  const projects = projectCount.get(client.id) ?? 0;
                  const owing = seeMoney && snapshot.outstandingMinor > BigInt(0);
                  return (
                    <DenseRow key={client.id}>
                      <DenseCell className="min-w-0 flex-1">
                        <Link
                          href={`/${orgSlug}/clients/${client.id}`}
                          className="flex min-w-0 items-center gap-3"
                        >
                          <AvatarMark name={client.name} size="sm" />
                          <div className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium">{client.name}</span>
                              {seeMoney ? (
                                <StatusChip tone={owing ? "overdue" : "paid"}>
                                  {owing ? "Owing" : "Settled"}
                                </StatusChip>
                              ) : null}
                            </span>
                            {seeMoney ? (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {owing ? "Open on ledger" : "Nothing outstanding"}
                              </p>
                            ) : (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground capitalize">
                                {client.kind}
                              </p>
                            )}
                          </div>
                        </Link>
                      </DenseCell>
                      <DenseCell
                        align="right"
                        width="hidden w-24 sm:block"
                        className="text-sm text-muted-foreground"
                      >
                        {projects}
                      </DenseCell>
                      {seeMoney ? (
                        <DenseCell align="right" width="w-28" className="text-sm font-medium">
                          {moneyLabel(snapshot.outstandingMinor, client.currency)}
                        </DenseCell>
                      ) : null}
                      <DenseCell align="right" width="w-28" className="text-xs">
                        <div className="flex flex-col items-end gap-1">
                          <Link
                            href={`/${orgSlug}/projects?client=${client.id}`}
                            className="text-muted-foreground underline-offset-2 hover:underline"
                          >
                            Projects
                          </Link>
                          {owing && canCollect ? (
                            <Link
                              href={`/${orgSlug}/finance?client=${client.id}`}
                              className="font-medium text-foreground underline-offset-2 hover:underline"
                            >
                              Collect
                            </Link>
                          ) : null}
                        </div>
                      </DenseCell>
                    </DenseRow>
                  );
                })}
              </DenseListPanel>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map(({ client, snapshot }) => {
                    const projects = projectCount.get(client.id) ?? 0;
                    const monthDue = seeMoney
                      ? dueThisMonthMinor(
                          (finance?.charges ?? []).filter((c) => c.clientId === client.id),
                        )
                      : BigInt(0);
                    return (
                      <SoftCard key={client.id} className="flex gap-4 p-4">
                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                          <Link href={`/${orgSlug}/clients/${client.id}`} className="flex gap-3">
                            <AvatarMark name={client.name} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{client.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {projects} project{projects === 1 ? "" : "s"}
                              </p>
                            </div>
                          </Link>
                          {seeMoney ? (
                            <>
                              <MoneyMetaCards
                                className="grid-cols-2"
                                items={[
                                  {
                                    label: "Due",
                                    value: moneyLabel(snapshot.outstandingMinor, client.currency),
                                    tone: "sky",
                                  },
                                  {
                                    label: "Month",
                                    value: moneyLabel(monthDue, client.currency),
                                    tone: "amber",
                                  },
                                ]}
                              />
                              {canCollect && snapshot.outstandingMinor > BigInt(0) ? (
                                <Button
                                  size="sm"
                                  className="self-start"
                                  nativeButton={false}
                                  render={
                                    <Link href={`/${orgSlug}/finance?client=${client.id}`} />
                                  }
                                >
                                  Collect
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                        {seeMoney ? (
                          <MoneyDonutCard
                            className="hidden shrink-0 self-center sm:block"
                            collected={Number(snapshot.collectedMinor)}
                            due={Number(snapshot.outstandingMinor)}
                            remaining={0}
                            collectedLabel="Collected"
                            dueLabel="Due"
                            remainingLabel="—"
                            centerValue={moneyLabel(snapshot.outstandingMinor, client.currency)}
                            centerLabel="Due"
                          />
                        ) : null}
                      </SoftCard>
                    );
                  })}
                </div>
              </div>
            )}
          </IndexBody>
        </>
      )}
    </WorkSurface>
  );
}
