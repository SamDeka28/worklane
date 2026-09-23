import Link from "next/link";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio/empty-state";
import { AvatarMark, SoftCard, StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { MoneyDonutCard, MoneyMetaCards } from "@/components/studio/money-donut";
import { StatusChip } from "@/components/studio/status-chip";
import {
  IndexBody,
  SummaryStat,
  SummaryStrip,
} from "@/components/studio/index-layout";
import { listClients } from "@/modules/clients/queries";
import { BILLING_MODE_LABEL, projectMoneyStats } from "@/modules/delivery/board";
import { CreateProjectDialog } from "@/modules/delivery/components/delivery-forms";
import { ProjectListPanel } from "@/modules/delivery/components/project-list";
import { ProjectStatusBoard } from "@/modules/delivery/components/project-status-board";
import { ProjectToolbar } from "@/modules/delivery/components/project-toolbar";
import { projectNextStep } from "@/modules/delivery/next-step";
import { listProjectBoard } from "@/modules/delivery/queries";
import type { ProjectStatus } from "@/modules/delivery/types";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
import { canSeeMoney } from "@/modules/identity/permissions";
import { moneyLabel } from "@/modules/finance/ledger";
import { dueThisMonthMinor, formatDay } from "@/modules/finance/presentation";
import { loadOrgFinance } from "@/modules/finance/queries";
import { JOURNEY } from "@/shared/journey-copy";

const PAGE_SIZE = 40;

const STATUS_TONE = {
  planning: "planning",
  active: "active",
  on_hold: "on_hold",
  completed: "completed",
  cancelled: "cancelled",
} as const;

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function ProjectsPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/projects">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  requireModuleAccess(ctx, "delivery");
  const seeMoney = canSeeMoney(ctx.permissions);
  const [board, clients, finance] = await Promise.all([
    listProjectBoard(orgSlug),
    listClients(orgSlug),
    seeMoney ? loadOrgFinance(orgSlug) : Promise.resolve(null),
  ]);
  const clientOptions = clients.map((client) => ({
    id: client.id,
    name: client.name,
    currency: client.currency,
  }));

  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const status = typeof query.status === "string" ? query.status : "";
  const clientId = typeof query.client === "string" ? query.client : "";
  const view =
    query.view === "cards" || query.view === "board" ? query.view : "list";
  const page = Math.max(1, Number(query.page) || 1);

  const filtered = board.filter((row) => {
    if (status && row.project.status !== status) return false;
    if (clientId && row.project.clientId !== clientId) return false;
    if (q) {
      const hay = `${row.project.name} ${row.project.clientName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible =
    view === "board"
      ? filtered
      : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const cards = visible.map((row) => {
    const projectCharges = seeMoney
      ? (finance?.charges.filter((charge) => charge.projectId === row.project.id) ?? [])
      : [];
    const money = projectMoneyStats(row.project, projectCharges);
    const monthDueMinor = seeMoney ? dueThisMonthMinor(projectCharges) : BigInt(0);
    const next = projectNextStep({
      billingMode: row.project.billingMode,
      logCount: row.logCount,
      openTasks: row.openTasks,
      unbilledMilestones: row.unbilledMilestones,
      outstandingMinor: seeMoney ? money.outstandingMinor : BigInt(0),
      milestoneCount: row.milestoneCount,
    });
    const nextHref =
      next.tab === "work"
        ? `/${orgSlug}/projects/${row.project.id}?tab=work&panel=${
            row.project.billingMode === "hourly" ? "log" : "board"
          }`
        : next.tab === "milestones"
          ? `/${orgSlug}/projects/${row.project.id}?tab=milestones`
          : `/${orgSlug}/projects/${row.project.id}?tab=charges&collect=1`;
    return {
      project: row.project,
      money,
      monthDueMinor,
      next,
      nextHref,
      openTasks: row.openTasks,
      unbilledMilestones: row.unbilledMilestones,
      milestoneCount: row.milestoneCount,
      logCount: row.logCount,
      lastWorkedOn: row.lastWorkedOn,
    };
  });

  const activeCount = board.filter(
    (r) => r.project.status === "active" || r.project.status === "planning",
  ).length;
  const dueTotal = seeMoney
    ? cards.reduce((sum, c) => sum + c.money.outstandingMinor, BigInt(0))
    : BigInt(0);
  const leftTotal = seeMoney
    ? cards.reduce((sum, c) => sum + c.money.remainingMinor, BigInt(0))
    : BigInt(0);
  const openTasks = cards.reduce((sum, c) => sum + c.openTasks, 0);
  const currency = cards[0]?.project.currency ?? ctx.org.defaultCurrency;

  return (
    <WorkSurface>
      <StudioToolbar
        purpose={JOURNEY.projects.purpose}
        actions={
          ctx.canWrite ? (
            <CreateProjectDialog
              orgSlug={orgSlug}
              clients={clientOptions}
              defaultOpen={query.new === "1"}
            />
          ) : null
        }
      />

      {board.length === 0 ? (
        <EmptyState
          fill
          title={
            clients.length === 0
              ? JOURNEY.projects.emptyNeedsClientTitle
              : JOURNEY.projects.emptyTitle
          }
          body={
            clients.length === 0
              ? JOURNEY.projects.emptyNeedsClientBody
              : JOURNEY.projects.emptyBody
          }
          actionHref={
            ctx.canWrite
              ? clients.length === 0
                ? `/${orgSlug}/clients?new=1`
                : `/${orgSlug}/projects?new=1`
              : undefined
          }
          actionLabel={
            ctx.canWrite
              ? clients.length === 0
                ? JOURNEY.clients.primaryCta
                : JOURNEY.projects.primaryCta
              : undefined
          }
        />
      ) : (
        <>
          <ProjectToolbar
            orgSlug={orgSlug}
            clients={clients.map((client) => ({ id: client.id, name: client.name }))}
            q={typeof query.q === "string" ? query.q : ""}
            status={status}
            clientId={clientId}
            view={view}
            page={page}
            pageCount={pageCount}
            total={filtered.length}
          />
          {view === "board" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {cards.length === 0 ? (
                <EmptyState fill title="No projects match these filters" />
              ) : (
                <ProjectStatusBoard
                  orgSlug={orgSlug}
                  canWrite={ctx.canWrite}
                  showMoney={seeMoney}
                  rows={cards.map((card) => ({
                    project: card.project,
                    outstandingMinor: seeMoney ? card.money.outstandingMinor : undefined,
                    openTasks: card.openTasks,
                  }))}
                />
              )}
            </div>
          ) : (
            <IndexBody className="gap-6">
              <SummaryStrip>
                <SummaryStat
                  label="Active"
                  value={String(activeCount)}
                  hint="Planning + delivery"
                  tone="sky"
                />
                {seeMoney ? (
                  <SummaryStat
                    label="Due"
                    value={moneyLabel(dueTotal, currency)}
                    hint="On the ledger"
                    tone="amber"
                  />
                ) : null}
                {seeMoney ? (
                  <SummaryStat
                    label="Left"
                    value={moneyLabel(leftTotal, currency)}
                    hint="Still to bill or collect"
                    tone="slate"
                  />
                ) : null}
                <SummaryStat
                  label="Open tasks"
                  value={String(openTasks)}
                  hint="Across filtered projects"
                  tone="emerald"
                />
              </SummaryStrip>
              {cards.length === 0 ? (
                <EmptyState fill title="No projects match these filters" />
              ) : view === "list" ? (
                <ProjectListPanel
                  orgSlug={orgSlug}
                  cards={cards}
                  showMoney={seeMoney}
                />
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto lane-inset p-4 sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                    {cards.map((card) => {
                      const activityParts = [
                        card.openTasks > 0
                          ? `${card.openTasks} open task${card.openTasks === 1 ? "" : "s"}`
                          : null,
                        card.unbilledMilestones > 0
                          ? `${card.unbilledMilestones} unbilled`
                          : null,
                        card.lastWorkedOn ? `worked ${formatDay(card.lastWorkedOn)}` : null,
                      ].filter(Boolean);

                      return (
                        <SoftCard key={card.project.id} className="flex gap-5 p-5">
                          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
                            <Link
                              href={`/${orgSlug}/projects/${card.project.id}`}
                              className="flex items-start gap-3"
                            >
                              <AvatarMark name={card.project.name} />
                              <div className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-semibold tracking-tight hover:text-primary">
                                    {card.project.name}
                                  </span>
                                  <StatusChip
                                    tone={STATUS_TONE[card.project.status as ProjectStatus]}
                                  >
                                    {STATUS_LABEL[card.project.status]}
                                  </StatusChip>
                                </span>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {card.project.clientName}
                                  {" · "}
                                  {BILLING_MODE_LABEL[card.project.billingMode]}
                                </p>
                                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                                  {activityParts.length > 0
                                    ? activityParts.join(" · ")
                                    : card.next.detail}
                                </p>
                              </div>
                            </Link>
                            {seeMoney ? (
                              <MoneyMetaCards
                                className="grid-cols-2"
                                items={[
                                  {
                                    label: "Due",
                                    value: moneyLabel(
                                      card.money.outstandingMinor,
                                      card.project.currency,
                                    ),
                                    tone: "sky",
                                  },
                                  {
                                    label: "Left",
                                    value: moneyLabel(
                                      card.money.remainingMinor,
                                      card.project.currency,
                                    ),
                                    tone: "violet",
                                  },
                                ]}
                              />
                            ) : null}
                            {ctx.canWrite ? (
                              <div className="mt-auto flex flex-wrap items-center gap-2 self-start">
                                <Link
                                  href={`/${orgSlug}/projects/${card.project.id}?tab=work&panel=board`}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/12 px-2.5 text-[13px] font-semibold text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/18 hover:ring-primary/35"
                                >
                                  <Columns3 className="size-3.5 opacity-90" aria-hidden />
                                  Board
                                </Link>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  nativeButton={false}
                                  render={<Link href={card.nextHref} />}
                                >
                                  {card.next.cta}
                                </Button>
                              </div>
                            ) : (
                              <Link
                                href={`/${orgSlug}/projects/${card.project.id}?tab=work&panel=board`}
                                className="mt-auto inline-flex h-8 items-center gap-1.5 self-start rounded-lg bg-primary/12 px-2.5 text-[13px] font-semibold text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/18 hover:ring-primary/35"
                              >
                                <Columns3 className="size-3.5 opacity-90" aria-hidden />
                                Board
                              </Link>
                            )}
                          </div>
                          {seeMoney ? (
                            <MoneyDonutCard
                              className="hidden shrink-0 self-center sm:block"
                              size="lg"
                              collected={Number(card.money.collectedMinor)}
                              due={Number(card.money.outstandingMinor)}
                              remaining={Number(
                                card.money.remainingMinor > card.money.outstandingMinor
                                  ? card.money.remainingMinor - card.money.outstandingMinor
                                  : BigInt(0),
                              )}
                              collectedLabel={`Collected · ${moneyLabel(card.money.collectedMinor, card.project.currency)}`}
                              dueLabel={`Due · ${moneyLabel(card.money.outstandingMinor, card.project.currency)}`}
                              remainingLabel={`Remaining · ${moneyLabel(card.money.remainingMinor, card.project.currency)}`}
                              centerValue={moneyLabel(
                                card.money.totalPriceMinor,
                                card.project.currency,
                              )}
                              centerLabel="Total"
                            />
                          ) : null}
                        </SoftCard>
                      );
                    })}
                  </div>
                </div>
              )}
            </IndexBody>
          )}
        </>
      )}
    </WorkSurface>
  );
}
