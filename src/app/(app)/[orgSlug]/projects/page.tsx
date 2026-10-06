import {
  FolderKanban,
  SearchX,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/studio/empty-state";
import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import {
  IndexBody,
  SummaryStat,
  SummaryStrip,
} from "@/components/studio/index-layout";
import { listClients } from "@/modules/clients/queries";
import { projectMoneyStats } from "@/modules/delivery/board";
import { CreateProjectDialog } from "@/modules/delivery/components/delivery-forms";
import { ProjectListPanel } from "@/modules/delivery/components/project-list";
import { ProjectStatusBoard } from "@/modules/delivery/components/project-status-board";
import { ProjectToolbar } from "@/modules/delivery/components/project-toolbar";
import { projectNextStep } from "@/modules/delivery/next-step";
import { projectTracksTime } from "@/modules/delivery/ledger";
import { listProjectBoard } from "@/modules/delivery/queries";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
import { canSeeMoney } from "@/modules/identity/permissions";
import { moneyLabel } from "@/modules/finance/ledger";
import { dueThisMonthMinor } from "@/modules/finance/presentation";
import { loadOrgFinance } from "@/modules/finance/queries";
import { JOURNEY } from "@/shared/journey-copy";

const PAGE_SIZE = 40;

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
  const view = query.view === "board" ? "board" : "list";
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
      retainerBasis: row.project.retainerBasis,
    });
    const nextHref =
      next.tab === "work"
        ? `/${orgSlug}/projects/${row.project.id}?tab=work&panel=${
            projectTracksTime(row.project.billingMode, row.project.retainerBasis) ? "log" : "board"
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
              deductions={ctx.deductions}
              defaultOpen={query.new === "1"}
            />
          ) : null
        }
      />

      {board.length === 0 ? (
        <EmptyState icon={clients.length === 0 ? Users : FolderKanban}
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
                <EmptyState icon={SearchX} fill title="No projects match these filters" />
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
                <EmptyState icon={SearchX} fill title="No projects match these filters" />
              ) : (
                <ProjectListPanel
                  orgSlug={orgSlug}
                  cards={cards}
                  showMoney={seeMoney}
                />
              )}
            </IndexBody>
          )}
        </>
      )}
    </WorkSurface>
  );
}
