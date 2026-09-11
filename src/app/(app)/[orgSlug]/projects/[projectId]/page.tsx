import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio/empty-state";
import {
  EntityChrome,
  FilterChip,
  FilterChips,
  HubBody,
  HubSection,
  NextStepCard,
  SoftTab,
  WorkSurface,
} from "@/components/studio/chrome";
import { StatusChip } from "@/components/studio/status-chip";
import { BILLING_MODE_LABEL, isOpenBoardColumn, projectMoneyStats } from "@/modules/delivery/board";
import {
  MilestoneForm,
  ProjectOverflow,
  ProjectSettingsSheet,
  WorkLogComposer,
} from "@/modules/delivery/components/delivery-forms";
import { KanbanBoard } from "@/modules/delivery/components/kanban-board";
import { MilestoneStudioList } from "@/modules/delivery/components/milestone-studio";
import { ProjectDocumentsHub } from "@/modules/delivery/components/project-docs";
import { ProjectOverviewRail } from "@/modules/delivery/components/project-overview-rail";
import { formatHoursMillis } from "@/modules/delivery/ledger";
import {
  chargeByMilestoneId,
  milestoneBillingLabel,
  milestoneBillingLife,
} from "@/modules/delivery/milestone-life";
import { projectNextStep } from "@/modules/delivery/next-step";
import {
  getProject,
  listMilestones,
  listMilestoneItemsForProject,
  listProjectColumns,
  listTaskComments,
  listTasks,
  listWorkLogs,
} from "@/modules/delivery/queries";
import { CreateDocumentDialog } from "@/modules/documents/components/document-forms";
import {
  listDocuments,
  listDocumentsForProjectSurface,
} from "@/modules/documents/queries";
import { CollectComposer } from "@/modules/finance/components/finance-forms";
import { ChargeRows } from "@/modules/finance/components/charge-board";
import { moneyLabel } from "@/modules/finance/ledger";
import { collectTargets, chargeTitle, formatDay } from "@/modules/finance/presentation";
import { loadProjectFinance } from "@/modules/finance/queries";
import { listFilesForEntity } from "@/modules/files/queries";
import { requireOrg, listOrgMembers } from "@/modules/identity/org";
import {
  ManageProjectPartnersDialog,
  ManageProjectTeamDialog,
  ProjectSplitDialog,
} from "@/modules/partners/components/partner-forms";
import { SplitPartnerTable } from "@/modules/partners/components/split-partner-table";
import { formatPoolSplitSummary, allocateEarned } from "@/modules/partners/ledger";
import {
  listPartners,
  listProjectDistributions,
  listProjectMembers,
  listProjectPartners,
  loadProjectPartnerEarnings,
} from "@/modules/partners/queries";
import { netFromGross } from "@/shared/money";

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PROJECT_TABS = ["overview", "milestones", "work", "charges", "split", "documents"] as const;
type ProjectTab = (typeof PROJECT_TABS)[number];

function resolveProjectTab(query: {
  tab?: string | string[];
  panel?: string | string[];
  collect?: string | string[];
  charge?: string | string[];
  bill?: string | string[];
  new?: string | string[];
}): ProjectTab {
  const tab = typeof query.tab === "string" ? query.tab : undefined;
  if (tab === "money") return "charges";
  if (tab && (PROJECT_TABS as readonly string[]).includes(tab)) {
    return tab as ProjectTab;
  }
  if (query.collect === "1" || typeof query.charge === "string") return "charges";
  if (query.bill || query.new === "milestone") return "milestones";
  if (query.panel === "log" || query.panel === "board") return "work";
  return "overview";
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/projects/[projectId]">) {
  const { orgSlug, projectId } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  const project = await getProject(orgSlug, projectId);
  if (!project) notFound();

  const isHourly = project.billingMode === "hourly";
  const tab = resolveProjectTab(query);
  const panel =
    query.panel === "log" ? "log" : query.panel === "board" ? "board" : isHourly ? "log" : "board";
  const selectedChargeId = typeof query.charge === "string" ? query.charge : undefined;
  const billId = typeof query.bill === "string" ? query.bill : undefined;
  const base = `/${orgSlug}/projects/${project.id}`;
  const tabHref = (next: ProjectTab, extra = "") => {
    const params = new URLSearchParams();
    params.set("tab", next);
    if (extra) {
      for (const part of extra.replace(/^\?/, "").split("&")) {
        if (!part) continue;
        const [key, value = ""] = part.split("=");
        if (key) params.set(key, value);
      }
    }
    return `${base}?${params.toString()}`;
  };

  const [milestones, milestoneItemsById, tasks, logs, finance, columns, documents, projectSurfaceDocs, partners, projectPartners, projectMembers, orgMembers, distributions, projectFiles, partnerEarnings] =
    await Promise.all([
      listMilestones(orgSlug, projectId),
      listMilestoneItemsForProject(orgSlug, projectId),
      listTasks(orgSlug, projectId),
      listWorkLogs(orgSlug, projectId),
      loadProjectFinance(orgSlug, projectId),
      listProjectColumns(orgSlug, projectId),
      listDocuments(orgSlug).catch(() => []),
      listDocumentsForProjectSurface(orgSlug, projectId).catch(() => []),
      listPartners(orgSlug).catch(() => []),
      listProjectPartners(orgSlug, projectId).catch(() => []),
      listProjectMembers(orgSlug, projectId).catch(() => []),
      listOrgMembers(orgSlug).catch(() => []),
      listProjectDistributions(orgSlug, projectId).catch(() => []),
      listFilesForEntity(orgSlug, "project", projectId).catch(() => []),
      loadProjectPartnerEarnings(orgSlug, projectId).catch(() => ({
        rows: [],
        details: [],
        totalEarnedMinor: BigInt(0),
      })),
    ]);
  const clientDocs = documents.filter((doc) => doc.clientId === project.clientId);
  const projectDocs = projectSurfaceDocs;
  const attachableDocs = clientDocs.filter((doc) => !doc.projectId);
  const needsPartners =
    ctx.canWrite && projectPartners.filter((partner) => partner.active).length === 0;
  const needsSplit =
    ctx.canWrite &&
    projectPartners.some((partner) => partner.active) &&
    distributions.length === 0;
  const comments = await listTaskComments(
    orgSlug,
    tasks.map((task) => task.id),
  );

  const columnById = new Map(columns.map((column) => [column.id, column]));
  const openTasks = tasks.filter((task) => {
    const column = task.columnId ? columnById.get(task.columnId) : null;
    return column ? isOpenBoardColumn(column.systemKey) : task.status !== "done";
  }).length;
  const unbilledMilestones = milestones.filter(
    (item) => !item.chargeId && item.amountMinor != null && item.status !== "cancelled",
  );
  const money = projectMoneyStats(project, finance.charges, milestones);
  const next = projectNextStep({
    billingMode: project.billingMode,
    logCount: logs.length,
    openTasks,
    unbilledMilestones: unbilledMilestones.length,
    outstandingMinor: money.outstandingMinor,
    milestoneCount: milestones.length,
  });
  const nextHref =
    next.tab === "work"
      ? tabHref("work", `panel=${isHourly ? "log" : "board"}`)
      : next.tab === "milestones"
        ? tabHref("milestones")
        : tabHref("charges", "collect=1");
  const chargesByMilestone = chargeByMilestoneId(finance.charges);
  const itemTaskIds = new Set(
    [...milestoneItemsById.values()]
      .flat()
      .map((item) => item.taskId)
      .filter((id): id is string => Boolean(id)),
  );
  const boardTaskByMilestone = new Map<string, string>();
  for (const task of tasks) {
    if (!task.milestoneId || itemTaskIds.has(task.id)) continue;
    if (!boardTaskByMilestone.has(task.milestoneId)) {
      boardTaskByMilestone.set(task.milestoneId, task.id);
    }
  }
  const milestoneCodeById = new Map(
    milestones.map((item, index) => [item.id, `M${index + 1}`] as const),
  );
  const taskMilestoneRefs: Record<string, { code: string; label: string }> = {};
  for (const task of tasks) {
    if (!task.milestoneId) continue;
    const code = milestoneCodeById.get(task.milestoneId) ?? "M?";
    taskMilestoneRefs[task.id] = { code, label: code };
  }
  for (const [milestoneId, items] of milestoneItemsById) {
    const code = milestoneCodeById.get(milestoneId) ?? "M?";
    for (const item of items) {
      if (!item.taskId) continue;
      taskMilestoneRefs[item.taskId] = {
        code,
        label: `${code} · ${item.title}`,
      };
    }
  }
  const lastRate =
    [...logs].reverse().find((log) => log.hourlyRateMinor != null)?.hourlyRateMinor ?? null;
  const showMilestoneComposer = Boolean(ctx.canWrite);
  const docsCount = projectDocs.length + projectFiles.length;
  const overviewMilestones = milestones.filter((item) => item.status !== "cancelled");
  const splitSeed = distributions[0]
    ? {
        poolAmountMinor: (distributions[0].poolAmountMinor ?? BigInt(0)).toString(),
        label: distributions[0].label,
        lines: distributions[0].lines.map((line) => ({
          partnerId: line.partnerId,
          role: (line.role ?? "pool") as "pool" | "remainder",
          poolShareBps: line.poolShareBps ?? null,
          shareBps: line.shareBps,
        })),
      }
    : null;
  const splitProjects = [
    {
      id: project.id,
      name: project.name,
      totalMinor: money.totalPriceMinor.toString(),
      feeBps: project.defaultFeeBps,
    },
  ];
  const feeBps = project.defaultFeeBps;
  const netTotalMinor =
    money.totalPriceMinor > BigInt(0)
      ? netFromGross(money.totalPriceMinor, feeBps)
      : BigInt(0);
  const feeMinor =
    money.totalPriceMinor > netTotalMinor
      ? money.totalPriceMinor - netTotalMinor
      : BigInt(0);
  const partnerCollectibles =
    distributions[0] && netTotalMinor > BigInt(0)
      ? allocateEarned(netTotalMinor, distributions[0].lines)
      : [];
  const poolAmountMinor = distributions[0]?.poolAmountMinor ?? null;
  const earnedByPartnerId = new Map(
    partnerEarnings.rows.map((row) => [row.partnerId, row.earnedMinor] as const),
  );
  const targetByPartnerId = new Map(
    partnerCollectibles.map((row) => [row.partnerId, row.earnedMinor] as const),
  );
  const chargeById = new Map(finance.charges.map((charge) => [charge.id, charge] as const));
  const milestoneNameById = new Map(milestones.map((item) => [item.id, item.name] as const));
  const chargesByPartnerId = (() => {
    const grouped = new Map<
      string,
      Map<string, { chargeId: string; earnedMinor: bigint; earnedOn: string }>
    >();
    for (const detail of partnerEarnings.details) {
      let byCharge = grouped.get(detail.partnerId);
      if (!byCharge) {
        byCharge = new Map();
        grouped.set(detail.partnerId, byCharge);
      }
      const existing = byCharge.get(detail.chargeId);
      if (existing) {
        existing.earnedMinor += detail.earnedMinor;
        if (detail.earnedOn > existing.earnedOn) existing.earnedOn = detail.earnedOn;
      } else {
        byCharge.set(detail.chargeId, {
          chargeId: detail.chargeId,
          earnedMinor: detail.earnedMinor,
          earnedOn: detail.earnedOn,
        });
      }
    }
    return grouped;
  })();
  const splitPartnerRows = (() => {
    const ids = new Set<string>();
    for (const partner of projectPartners) ids.add(partner.id);
    for (const row of partnerCollectibles) ids.add(row.partnerId);
    for (const row of partnerEarnings.rows) ids.add(row.partnerId);
    return [...ids].map((partnerId) => {
      const partner = projectPartners.find((p) => p.id === partnerId);
      const line = distributions[0]?.lines.find((row) => row.partnerId === partnerId);
      const targetMinor = targetByPartnerId.get(partnerId) ?? BigInt(0);
      const earnedMinor = earnedByPartnerId.get(partnerId) ?? BigInt(0);
      const stillMinor =
        targetMinor > earnedMinor ? targetMinor - earnedMinor : BigInt(0);
      const shareLabel =
        line?.role === "remainder"
          ? "Remainder"
          : line?.poolShareBps != null
            ? `${(line.poolShareBps / 100).toFixed(0)}% of pool`
            : line
              ? `${(line.shareBps / 100).toFixed(1)}%`
              : "—";
      const effectiveLabel =
        line != null ? `${(line.shareBps / 100).toFixed(1)}% effective` : null;
      const chargeRows = [...(chargesByPartnerId.get(partnerId)?.values() ?? [])]
        .sort((a, b) => b.earnedOn.localeCompare(a.earnedOn))
        .map((item) => {
          const charge = chargeById.get(item.chargeId);
          const milestoneName = charge?.milestoneId
            ? milestoneNameById.get(charge.milestoneId)
            : null;
          const label =
            milestoneName ??
            (charge ? chargeTitle(charge) : "Charge");
          return {
            chargeId: item.chargeId,
            label,
            dateLabel: formatDay(item.earnedOn),
            amountLabel: moneyLabel(item.earnedMinor, project.currency),
            href: tabHref("charges", `charge=${item.chargeId}`),
          };
        });
      return {
        partnerId,
        name: partner?.name ?? "Partner",
        shareLabel,
        effectiveLabel,
        targetLabel: moneyLabel(targetMinor, project.currency),
        earnedLabel: moneyLabel(earnedMinor, project.currency),
        stillLabel: moneyLabel(stillMinor, project.currency),
        progress:
          targetMinor > BigInt(0)
            ? Number(earnedMinor) / Number(targetMinor)
            : null,
        earnedMinor,
        charges: chargeRows,
      };
    });
  })();
  const totalEarnedMinor = partnerEarnings.totalEarnedMinor;

  const primaryCta = !ctx.canWrite ? null : next.cta === "Add milestone" ? (
    <MilestoneForm
      key={`header-milestone-${String(query.new)}`}
      orgSlug={orgSlug}
      projectId={project.id}
      billingMode={project.billingMode}
      defaultOpen={query.new === "milestone"}
      returnHref={tabHref("milestones")}
      triggerSize="lg"
      triggerLabel="Add milestone"
    />
  ) : (
    <Button size="lg" nativeButton={false} render={<Link href={nextHref} />}>
      {next.cta}
    </Button>
  );

  return (
    <WorkSurface>
      <EntityChrome
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{project.name}</span>
            <StatusChip tone={project.status === "active" ? "active" : "planning"}>
              {STATUS_LABEL[project.status]}
            </StatusChip>
          </span>
        }
        meta={
          <>
            <Link
              href={`/${orgSlug}/clients/${project.clientId}`}
              className="font-medium text-foreground hover:underline"
            >
              {project.clientName}
            </Link>
            <span aria-hidden>·</span>
            <span>{BILLING_MODE_LABEL[project.billingMode]}</span>
            {project.dueOn ? (
              <>
                <span aria-hidden>·</span>
                <span>Due {formatDay(project.dueOn)}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span className="tabular-nums font-semibold text-foreground">
              {money.totalPriceMinor > BigInt(0)
                ? `${moneyLabel(money.totalPriceMinor, project.currency)} total`
                : `${moneyLabel(money.outstandingMinor, project.currency)} due`}
            </span>
          </>
        }
        primaryAction={
          ctx.canWrite ? (
            <div className="flex items-center gap-2">
              {primaryCta}
              <ProjectOverflow
                orgSlug={orgSlug}
                projectId={project.id}
                clientId={project.clientId}
                billingMode={project.billingMode}
                settingsHref={`${base}?tab=${tab}&settings=1`}
              />
              <ProjectSettingsSheet
                key={String(query.settings)}
                orgSlug={orgSlug}
                project={project}
                hideTrigger
                defaultOpen={query.settings === "1"}
                returnHref={tabHref(tab)}
              />
            </div>
          ) : null
        }
      />

      <div className="flex shrink-0 flex-wrap gap-1 border-b border-border/30 px-5 py-2">
        <SoftTab href={tabHref("overview")} active={tab === "overview"}>
          Overview
        </SoftTab>
        <SoftTab href={tabHref("milestones")} active={tab === "milestones"}>
          Milestones
          {milestones.length > 0 ? ` · ${milestones.length}` : ""}
        </SoftTab>
        <SoftTab
          href={tabHref("work", `panel=${isHourly ? "log" : "board"}`)}
          active={tab === "work"}
        >
          Work
          {openTasks > 0 ? ` · ${openTasks}` : ""}
        </SoftTab>
        <SoftTab href={tabHref("charges")} active={tab === "charges"}>
          Charges
          {money.outstandingMinor > BigInt(0)
            ? ` · ${moneyLabel(money.outstandingMinor, project.currency)}`
            : ""}
        </SoftTab>
        <SoftTab href={tabHref("split")} active={tab === "split"}>
          Split
          {totalEarnedMinor > BigInt(0)
            ? ` · ${moneyLabel(totalEarnedMinor, project.currency)}`
            : ""}
        </SoftTab>
        <SoftTab href={tabHref("documents")} active={tab === "documents"}>
          Documents
          {docsCount > 0 ? ` · ${docsCount}` : ""}
        </SoftTab>
      </div>

      <HubBody className="gap-4">
        {tab === "overview" ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] lg:items-start">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-3xl bg-muted/40 px-4 py-3 text-sm ring-1 ring-border/30">
                <Link
                  href={tabHref("work", `panel=${isHourly ? "log" : "board"}`)}
                  className="hover:text-foreground"
                >
                  <span className="text-muted-foreground">Tasks </span>
                  <span className="font-semibold tabular-nums">{openTasks}</span>
                </Link>
                <Link href={tabHref("milestones")} className="hover:text-foreground">
                  <span className="text-muted-foreground">Ready </span>
                  <span className="font-semibold tabular-nums">{unbilledMilestones.length}</span>
                </Link>
                <Link href={tabHref("charges")} className="hover:text-foreground">
                  <span className="text-muted-foreground">Owed </span>
                  <span className="font-semibold tabular-nums">
                    {moneyLabel(money.outstandingMinor, project.currency)}
                  </span>
                </Link>
                <Link href={tabHref("documents")} className="hover:text-foreground">
                  <span className="text-muted-foreground">Docs </span>
                  <span className="font-semibold tabular-nums">{docsCount}</span>
                </Link>
                {money.totalPriceMinor > BigInt(0) ? (
                  <span className="ml-auto">
                    <span className="text-muted-foreground">Total </span>
                    <span className="font-semibold tabular-nums">
                      {moneyLabel(money.totalPriceMinor, project.currency)}
                    </span>
                  </span>
                ) : null}
              </div>

              <NextStepCard
                title={next.title}
                body={next.detail}
                action={
                  ctx.canWrite && next.cta !== "Add milestone" ? (
                    <Button size="sm" nativeButton={false} render={<Link href={nextHref} />}>
                      {next.cta}
                    </Button>
                  ) : null
                }
              />

              {needsPartners ? (
                <NextStepCard
                  title="Add partners"
                  body="Who earns on this project"
                  action={
                    <ManageProjectPartnersDialog
                      orgSlug={orgSlug}
                      projectId={project.id}
                      assigned={projectPartners}
                      available={partners}
                      triggerLabel="Add"
                      triggerVariant="outline"
                    />
                  }
                />
              ) : null}

              {needsSplit ? (
                <NextStepCard
                  title="Set build pool"
                  body="Pool vs remainder split"
                  action={
                    <ProjectSplitDialog
                      orgSlug={orgSlug}
                      currency={project.currency}
                      projects={splitProjects}
                      partners={projectPartners}
                      initialSplit={splitSeed}
                      defaultProjectId={project.id}
                      triggerLabel="Set"
                      triggerVariant="outline"
                    />
                  }
                />
              ) : null}

              {(project.billingMode === "milestones" ||
                project.billingMode === "single_charge" ||
                milestones.length > 0) && (
                <HubSection
                  title="Milestones"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={tabHref("milestones")} />}
                    >
                      View all
                    </Button>
                  }
                >
                  {overviewMilestones.length === 0 ? (
                    <EmptyState
                      title="No milestones yet"
                      body="Add the first billable slice from the header or Milestones tab."
                    />
                  ) : (
                    <ul className="divide-y divide-border/35 overflow-hidden rounded-3xl bg-card/60 ring-1 ring-border/30">
                      {overviewMilestones.map((item, index) => {
                        const charge = chargesByMilestone.get(item.id);
                        const life = milestoneBillingLife(item, charge);
                        const tone =
                          life === "paid"
                            ? "paid"
                            : life === "overdue"
                              ? "overdue"
                              : life === "unbilled"
                                ? "planning"
                                : "due";
                        return (
                          <li key={item.id}>
                            <Link
                              href={tabHref("milestones")}
                              className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-sky-50/40"
                            >
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-medium">
                                    <span className="mr-1.5 text-muted-foreground">
                                      M{index + 1}
                                    </span>
                                    {item.name}
                                  </p>
                                  <StatusChip tone={tone}>
                                    {milestoneBillingLabel(life)}
                                  </StatusChip>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.dueOn ? `Due ${formatDay(item.dueOn)}` : "No due date"}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold tabular-nums tracking-tight">
                                {item.amountMinor != null
                                  ? moneyLabel(item.amountMinor, project.currency)
                                  : "—"}
                              </p>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </HubSection>
              )}
            </div>

            <ProjectOverviewRail
              currency={project.currency}
              money={money}
              feeBps={feeBps}
              feeMinor={feeMinor}
              netTotalMinor={netTotalMinor}
              poolAmountMinor={poolAmountMinor}
              totalEarnedMinor={totalEarnedMinor}
              splitRows={splitPartnerRows}
              splitHref={tabHref("split")}
            />
          </div>
        ) : null}

        {tab === "milestones" ? (
          <HubSection
            id="milestones"
            title="Milestones"
            action={
              showMilestoneComposer ? (
                <MilestoneForm
                  key="section-milestone"
                  orgSlug={orgSlug}
                  projectId={project.id}
                  billingMode={project.billingMode}
                  returnHref={tabHref("milestones")}
                  triggerVariant="outline"
                  triggerSize="default"
                />
              ) : null
            }
          >
            {milestones.length === 0 ? (
              <EmptyState
                title="No milestones yet"
                body="Name a billable slice — amount optional until you’re ready to charge."
              />
            ) : (
              <MilestoneStudioList
                orgSlug={orgSlug}
                projectId={project.id}
                billingMode={project.billingMode}
                currency={project.currency}
                milestones={milestones}
                itemsByMilestone={Object.fromEntries(milestoneItemsById)}
                chargeByMilestone={chargesByMilestone}
                taskByMilestone={boardTaskByMilestone}
                canWrite={ctx.canWrite}
                collectBaseHref={tabHref("charges", "collect=1")}
                workHref={tabHref("work", "panel=board")}
                highlightMilestoneId={billId}
              />
            )}
          </HubSection>
        ) : null}

        {tab === "work" ? (
          <HubSection
            id="work"
            title="Work"
            action={
              <FilterChips className="px-0 py-0">
                {isHourly ? (
                  <FilterChip href={tabHref("work", "panel=log")} active={panel === "log"}>
                    Log
                  </FilterChip>
                ) : null}
                <FilterChip href={tabHref("work", "panel=board")} active={panel === "board"}>
                  Board · {openTasks}
                </FilterChip>
              </FilterChips>
            }
          >
            {panel === "board" ? (
              <div className="flex min-h-112 flex-col overflow-hidden rounded-[1.75rem] bg-muted/30 ring-1 ring-border/30">
                <div className="min-h-0 flex-1 overflow-auto">
                  <KanbanBoard
                    orgSlug={orgSlug}
                    projectId={project.id}
                    columns={columns}
                    tasks={tasks}
                    milestones={milestones.map((item, index) => ({
                      id: item.id,
                      name: `M${index + 1} · ${item.name}`,
                    }))}
                    taskMilestoneRefs={taskMilestoneRefs}
                    comments={comments}
                    canWrite={ctx.canWrite}
                    currentUserId={ctx.userId}
                    assignees={projectMembers.map((member) => {
                      const orgMember = orgMembers.find((row) => row.userId === member.userId);
                      return {
                        userId: member.userId,
                        label: member.isYou
                          ? "You"
                          : orgMember?.displayName ||
                            orgMember?.email ||
                            `Member ${member.userId.slice(0, 8)}`,
                      };
                    })}
                  />
                </div>
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                title="Log the first day"
                body="Date, hours, rate or a fixed amount — one row replaces the spreadsheet."
              />
            ) : (
              <ol className="space-y-2">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-3xl bg-muted/40 px-4 py-3 ring-1 ring-border/30"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{formatDay(log.workedOn)}</p>
                      <StatusChip tone={log.chargeId ? "paid" : "due"}>
                        {log.chargeId ? "Charged" : "No charge"}
                      </StatusChip>
                    </div>
                    <p className="mt-1 text-sm">{log.description || "Work logged"}</p>
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                      {log.fixedMinor != null && log.fixedMinor > BigInt(0)
                        ? moneyLabel(log.fixedMinor, project.currency)
                        : log.hoursMillis != null
                          ? `${formatHoursMillis(log.hoursMillis)}h${
                              log.hourlyRateMinor
                                ? ` × ${moneyLabel(log.hourlyRateMinor, project.currency)}`
                                : ""
                            }`
                          : "—"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </HubSection>
        ) : null}

        {tab === "charges" ? (
          <HubSection id="charges" title="Charges">
            {finance.charges.length === 0 ? (
              <EmptyState
                title="No charges yet"
                body={
                  project.billingMode === "milestones"
                    ? "Charge a milestone to post the first amount on the ledger."
                    : "Log work or charge a milestone to post the first amount."
                }
              />
            ) : (
              <>
                <ChargeRows
                  orgSlug={orgSlug}
                  charges={finance.charges}
                  canWrite={ctx.canWrite}
                  activeChargeId={selectedChargeId}
                  collectHref={(chargeId) => tabHref("charges", `collect=1&charge=${chargeId}`)}
                />
                {milestones.some((item) => item.chargeId) ? (
                  <ul className="mt-4 space-y-2 rounded-[1.75rem] bg-muted/40 p-4 ring-1 ring-border/30">
                    {milestones
                      .filter((item) => item.chargeId)
                      .map((item) => {
                        const charge = chargesByMilestone.get(item.id);
                        const life = milestoneBillingLife(item, charge);
                        return (
                          <li
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span className="font-medium">{item.name}</span>
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              <StatusChip tone={life === "paid" ? "paid" : "due"}>
                                {milestoneBillingLabel(life)}
                              </StatusChip>
                              {charge && charge.outstandingMinor > BigInt(0) ? (
                                <Link
                                  className="font-medium underline underline-offset-2"
                                  href={tabHref("charges", `collect=1&charge=${charge.id}`)}
                                >
                                  Collect
                                </Link>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                ) : null}
                {ctx.canWrite && money.outstandingMinor > BigInt(0) ? (
                  <div className="mt-4">
                    <CollectComposer
                      orgSlug={orgSlug}
                      clientId={project.clientId}
                      targets={collectTargets(finance.charges)}
                      defaultChargeId={selectedChargeId}
                    />
                  </div>
                ) : null}
              </>
            )}
          </HubSection>
        ) : null}

        {tab === "split" ? (
          <div className="space-y-4">
            <HubSection
              title="Economics"
              action={
                ctx.canWrite ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ManageProjectTeamDialog
                      orgSlug={orgSlug}
                      projectId={project.id}
                      members={projectMembers}
                      orgMembers={orgMembers}
                      triggerLabel="Team"
                      triggerVariant="outline"
                    />
                    <ManageProjectPartnersDialog
                      orgSlug={orgSlug}
                      projectId={project.id}
                      assigned={projectPartners}
                      available={partners}
                      triggerLabel="Partners"
                      triggerVariant="outline"
                    />
                    {projectPartners.some((partner) => partner.active) ? (
                      <ProjectSplitDialog
                        orgSlug={orgSlug}
                        currency={project.currency}
                        projects={splitProjects}
                        partners={projectPartners}
                        initialSplit={splitSeed}
                        defaultProjectId={project.id}
                        triggerLabel={needsSplit ? "Set split" : "Edit split"}
                        triggerVariant={needsSplit ? "default" : "outline"}
                      />
                    ) : null}
                  </div>
                ) : null
              }
            >
              <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
                <div className="rounded-[1.5rem] bg-linear-to-br from-sky-50/90 via-white to-emerald-50/40 px-5 py-4 shadow-soft ring-1 ring-sky-200/50">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.08em] text-sky-800/70 uppercase">
                        Distributable
                      </p>
                      <p className="mt-1 font-heading text-3xl font-semibold tracking-tight tabular-nums">
                        {netTotalMinor > BigInt(0)
                          ? moneyLabel(netTotalMinor, project.currency)
                          : "—"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        After{" "}
                        {feeBps > 0
                          ? `${(feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2)}% `
                          : ""}
                        platform fee
                        {feeMinor > BigInt(0)
                          ? ` (−${moneyLabel(feeMinor, project.currency)})`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                        Client total
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {money.totalPriceMinor > BigInt(0)
                          ? moneyLabel(money.totalPriceMinor, project.currency)
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-card/90 px-5 py-4 shadow-soft ring-1 ring-border/30">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    Earned to date
                  </p>
                  <p className="mt-1 font-heading text-3xl font-semibold tracking-tight tabular-nums">
                    {moneyLabel(totalEarnedMinor, project.currency)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Collected {moneyLabel(money.collectedMinor, project.currency)} · Remaining{" "}
                    {moneyLabel(money.remainingMinor, project.currency)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.35rem] bg-muted/35 px-4 py-3 ring-1 ring-border/25">
                  <p className="text-[11px] text-muted-foreground">Target pool</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {poolAmountMinor != null
                      ? moneyLabel(poolAmountMinor, project.currency)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-[1.35rem] bg-muted/35 px-4 py-3 ring-1 ring-border/25">
                  <p className="text-[11px] text-muted-foreground">Remainder</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {poolAmountMinor != null && netTotalMinor > BigInt(0)
                      ? moneyLabel(
                          netTotalMinor > poolAmountMinor
                            ? netTotalMinor - poolAmountMinor
                            : BigInt(0),
                          project.currency,
                        )
                      : "—"}
                  </p>
                </div>
              </div>

              {distributions[0] ? (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {formatPoolSplitSummary({
                    poolAmountMinor: distributions[0].poolAmountMinor,
                    projectTotalMinor: netTotalMinor,
                    lines: distributions[0].lines,
                    partnerName: (id) =>
                      projectPartners.find((p) => p.id === id)?.name ?? "Partner",
                    money: (minor) => moneyLabel(minor, project.currency),
                  })}
                </p>
              ) : null}
            </HubSection>

            <HubSection title="Partners">
              {splitPartnerRows.length === 0 ? (
                <EmptyState
                  title={needsPartners ? "No partners yet" : "No split yet"}
                  body={
                    needsPartners
                      ? "Assign who earns on this project, then set the build pool."
                      : "Set a pool vs remainder split to see target collectibles."
                  }
                  action={
                    ctx.canWrite ? (
                      needsPartners ? (
                        <ManageProjectPartnersDialog
                          orgSlug={orgSlug}
                          projectId={project.id}
                          assigned={projectPartners}
                          available={partners}
                          triggerLabel="Add partners"
                        />
                      ) : (
                        <ProjectSplitDialog
                          orgSlug={orgSlug}
                          currency={project.currency}
                          projects={splitProjects}
                          partners={projectPartners}
                          initialSplit={splitSeed}
                          defaultProjectId={project.id}
                          triggerLabel="Set split"
                        />
                      )
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <SplitPartnerTable rows={splitPartnerRows} />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Target is of distributable after platform fee. Earned is posted from{" "}
                    {project.earnOn === "receipt"
                      ? "collections (earn on receipt)"
                      : "charges (earn on charge)"}
                    . Expand a partner to see the charges that built their earned total.
                  </p>
                </>
              )}
            </HubSection>

            {ctx.canWrite || projectMembers.length > 0 ? (
              <HubSection title="Access">
                {projectMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Owners & admins always have access. Add leads or members for scoped access.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/35 overflow-hidden rounded-3xl ring-1 ring-border/30">
                    {projectMembers.map((member) => (
                      <li
                        key={member.id}
                        className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                      >
                        <span>
                          {member.isYou ? "You" : `Member ${member.userId.slice(0, 8)}`}
                        </span>
                        <span className="text-[11px] capitalize text-muted-foreground">
                          {member.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </HubSection>
            ) : null}
          </div>
        ) : null}

        {tab === "documents" ? (
          <HubSection title="Documents">
            <ProjectDocumentsHub
              orgSlug={orgSlug}
              projectId={project.id}
              clientId={project.clientId}
              documents={projectDocs.map((doc) => ({
                id: doc.id,
                title: doc.title,
                kind: doc.kind,
                status: doc.status,
                projectId: doc.projectId,
                mentionCount: doc.mentionCount,
                mentionedVia: doc.mentionedVia,
              }))}
              attachable={attachableDocs.map((doc) => ({
                id: doc.id,
                title: doc.title,
                kind: doc.kind,
                status: doc.status,
                projectId: doc.projectId,
              }))}
              files={projectFiles}
              canWrite={ctx.canWrite}
              createDocument={
                ctx.canWrite ? (
                  <CreateDocumentDialog
                    orgSlug={orgSlug}
                    triggerLabel="New in Docs"
                    triggerVariant="outline"
                    defaultClientId={project.clientId}
                    defaultProjectId={project.id}
                    clients={[{ id: project.clientId, name: project.clientName }]}
                    projects={[
                      {
                        id: project.id,
                        name: project.name,
                        clientId: project.clientId,
                      },
                    ]}
                  />
                ) : null
              }
            />
          </HubSection>
        ) : null}
      </HubBody>

      {tab === "work" && isHourly && panel === "log" && ctx.canWrite ? (
        <WorkLogComposer
          orgSlug={orgSlug}
          projectId={project.id}
          billingMode={project.billingMode}
          milestones={milestones}
          currency={project.currency}
          defaultFeeBps={project.defaultFeeBps}
          defaultHourlyRateMinor={lastRate}
        />
      ) : null}
    </WorkSurface>
  );
}
