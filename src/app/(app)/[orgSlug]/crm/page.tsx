import { SearchX, Target } from "lucide-react";
import { notFound } from "next/navigation";
import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
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
import { cn } from "@/lib/utils";
import { LeadBoard } from "@/modules/crm/components/lead-board";
import { CreateLeadDialog } from "@/modules/crm/components/lead-forms";
import { CrmLeadSheet, LeadOpenLink } from "@/modules/crm/components/crm-lead-sheet";
import { CrmReports } from "@/modules/crm/components/crm-reports";
import { CrmSettingsSheet } from "@/modules/crm/components/crm-settings-sheet";
import { CrmToolbar, type CrmFilters, type CrmView } from "@/modules/crm/components/crm-toolbar";
import { LeadImportSheet } from "@/modules/crm/components/lead-import-sheet";
import { LeadJourneyConfig } from "@/modules/crm/components/lead-journey-config";
import { dueLabel } from "@/modules/crm/presentation";
import {
  getCrmSettings,
  getLead,
  leadEmailSender,
  listCrmMembers,
  listLeadStageMoves,
  listLeads,
  listLeadStages,
} from "@/modules/crm/queries";
import {
  followState,
  isClosedStage,
  isStale,
  isWonStage,
  stageLabel,
  stageTone,
  stagesOrDefault,
  type LeadRecord,
} from "@/modules/crm/types";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
import { canDeleteModule, canSeeMoney } from "@/modules/identity/permissions";
import { JOURNEY } from "@/shared/journey-copy";
import { formatMoney, type IsoCurrency } from "@/shared/money";

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function pipelineTotals(leads: LeadRecord[], fallback: IsoCurrency) {
  const totals = new Map<IsoCurrency, bigint>();
  for (const lead of leads) {
    if (lead.estimatedValueMinor == null) continue;
    totals.set(lead.currency, (totals.get(lead.currency) ?? BigInt(0)) + lead.estimatedValueMinor);
  }
  const parts = [...totals.entries()].map(([currency, amountMinor]) =>
    formatMoney({ amountMinor, currency }),
  );
  return parts.length > 0 ? parts.join(" + ") : formatMoney({ amountMinor: BigInt(0), currency: fallback });
}

export default async function CrmPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/crm">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  requireModuleAccess(ctx, "crm");
  if (!ctx.org.modules.crm) notFound();
  const seeMoney = canSeeMoney(ctx.permissions);

  const view: CrmView =
    query.view === "list" ? "list" : query.view === "reports" ? "reports" : "board";
  const filters: CrmFilters = {
    q: param(query.q),
    owner: param(query.owner),
    due: param(query.due),
    source: param(query.source),
    tag: param(query.tag),
  };
  const leadId = param(query.lead) || undefined;
  const prefillClientId = query.new === "1" ? param(query.client) : "";

  const [allLeads, selected, stageRows, settings, members, moves, prefillClient] =
    await Promise.all([
      listLeads(orgSlug, { q: filters.q || undefined }),
      leadId ? getLead(orgSlug, leadId) : Promise.resolve(null),
      listLeadStages(orgSlug),
      getCrmSettings(orgSlug),
      listCrmMembers(orgSlug),
      view === "reports" ? listLeadStageMoves(orgSlug) : Promise.resolve([]),
      prefillClientId
        ? ctx.supabase
            .from("clients")
            .select("id, name")
            .eq("organization_id", ctx.org.id)
            .eq("id", prefillClientId)
            .maybeSingle()
            .then(({ data }) => (data ? { id: String(data.id), name: String(data.name) } : null))
        : Promise.resolve(null),
    ]);
  const stages = stagesOrDefault(stageRows);

  const isOpen = (lead: LeadRecord) => !isClosedStage(lead.stage, stages);
  const leads = allLeads.filter((lead) => {
    if (filters.owner === "me" && lead.ownerUserId !== ctx.userId) return false;
    if (filters.owner === "none" && lead.ownerUserId) return false;
    if (
      filters.owner &&
      filters.owner !== "me" &&
      filters.owner !== "none" &&
      lead.ownerUserId !== filters.owner
    ) {
      return false;
    }
    if (filters.due) {
      if (!isOpen(lead)) return false;
      const follow = followState(lead);
      if (filters.due === "overdue" && follow !== "overdue") return false;
      if (filters.due === "today" && follow !== "today") return false;
      if (filters.due === "stale" && !isStale(lead, settings.staleDays)) return false;
      if (filters.due === "none" && lead.nextAction) return false;
    }
    if (filters.source && (lead.source ?? "").toLowerCase() !== filters.source.toLowerCase()) {
      return false;
    }
    if (filters.tag && !lead.tags.includes(filters.tag)) return false;
    return true;
  });

  const sourceOptions = [
    ...new Set([
      ...settings.sources,
      ...allLeads.map((lead) => lead.source?.trim()).filter((s): s is string => Boolean(s)),
    ]),
  ];
  const tagOptions = [...new Set(allLeads.flatMap((lead) => lead.tags))].sort();
  const filtered = Object.values(filters).some(Boolean);

  const openLeads = leads.filter(isOpen);
  const won = leads.filter((l) => isWonStage(l.stage, stages)).length;
  const overdueCount = openLeads.filter((lead) => followState(lead) === "overdue").length;
  const memberName = new Map(members.map((member) => [member.userId, member.name]));
  const canDelete = canDeleteModule(ctx, "crm");

  return (
    <WorkSurface>
      <StudioToolbar
        purpose={JOURNEY.leads.purpose}
        actions={
          ctx.canWrite ? (
            <div className="flex items-center gap-2">
              <LeadImportSheet orgSlug={orgSlug} members={members} currentUserId={ctx.userId} />
              <CrmSettingsSheet
                orgSlug={orgSlug}
                stages={stages}
                settings={settings}
                members={members}
              />
              <LeadJourneyConfig orgSlug={orgSlug} stages={stages} canWrite={ctx.canWrite} />
              <CreateLeadDialog
                orgSlug={orgSlug}
                stages={stages}
                defaultCurrency={ctx.org.defaultCurrency}
                showMoney={seeMoney}
                settings={settings}
                members={members}
                currentUserId={ctx.userId}
                prefillClient={prefillClient}
              />
            </div>
          ) : null
        }
      />

      <CrmToolbar
        orgSlug={orgSlug}
        view={view}
        filters={filters}
        members={members}
        sources={sourceOptions}
        tags={tagOptions}
        count={leads.length}
      />

      {view === "reports" ? (
        <CrmReports
          leads={leads}
          stages={stages}
          moves={moves}
          members={members}
          showMoney={seeMoney}
          currency={ctx.org.defaultCurrency}
        />
      ) : view === "board" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {allLeads.length === 0 && !filtered ? (
            <EmptyState
              icon={Target}
              fill
              title={JOURNEY.leads.emptyTitle}
              body={JOURNEY.leads.emptyBody}
              actionHref={ctx.canWrite ? `/${orgSlug}/crm?new=1` : undefined}
              actionLabel={ctx.canWrite ? JOURNEY.leads.primaryCta : undefined}
            />
          ) : (
            <LeadBoard
              orgSlug={orgSlug}
              leads={leads}
              stages={stages}
              canWrite={ctx.canWrite}
              showMoney={seeMoney}
              members={members}
              staleDays={settings.staleDays}
              lostReasons={settings.lostReasons}
            />
          )}
        </div>
      ) : (
        <IndexBody>
          {leads.length > 0 ? (
            <SummaryStrip>
              <SummaryStat label="Open" value={String(openLeads.length)} tone="sky" />
              {seeMoney ? (
                <SummaryStat
                  label="Pipeline"
                  value={pipelineTotals(openLeads, ctx.org.defaultCurrency)}
                  hint="Estimated value"
                  tone="amber"
                />
              ) : null}
              <SummaryStat
                label="Overdue"
                value={String(overdueCount)}
                hint="Next steps past due"
                tone="rose"
              />
              <SummaryStat label="Won" value={String(won)} tone="emerald" />
            </SummaryStrip>
          ) : null}
          {leads.length === 0 ? (
            <EmptyState
              icon={filtered ? SearchX : Target}
              fill
              title={filtered ? "No leads match" : JOURNEY.leads.emptyTitle}
              body={filtered ? undefined : JOURNEY.leads.emptyBody}
              actionHref={ctx.canWrite && !filtered ? `/${orgSlug}/crm?new=1` : undefined}
              actionLabel={ctx.canWrite && !filtered ? JOURNEY.leads.primaryCta : undefined}
            />
          ) : (
            <DenseListPanel
              columns={
                <>
                  <span className="min-w-0 flex-1">Lead</span>
                  <span className="hidden w-44 lg:block">Next step</span>
                  <span className="hidden w-28 md:block">Owner</span>
                  <span className="hidden w-28 text-right sm:block">Stage</span>
                  {seeMoney ? (
                    <span className="hidden w-28 text-right md:block">Value</span>
                  ) : null}
                </>
              }
              footer="Win a lead, then Become a client: no retyping."
            >
              {leads.map((lead) => {
                const follow = isOpen(lead) ? followState(lead) : "none";
                return (
                  <DenseRow key={lead.id}>
                    <DenseCell className="min-w-0 flex-1">
                      <LeadOpenLink
                        leadId={lead.id}
                        href={`/${orgSlug}/crm?view=list&lead=${lead.id}`}
                        className="block min-w-0"
                      >
                        <p className="truncate text-sm font-medium">{lead.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[lead.company, lead.email, lead.source].filter(Boolean).join(" · ") ||
                            "-"}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground sm:hidden">
                          <StatusChip tone={stageTone(lead.stage, stages)}>
                            {stageLabel(lead.stage, stages)}
                          </StatusChip>
                          {seeMoney && lead.estimatedValueMinor != null
                            ? formatMoney({
                                amountMinor: lead.estimatedValueMinor,
                                currency: lead.currency,
                              })
                            : null}
                        </p>
                      </LeadOpenLink>
                    </DenseCell>
                    <DenseCell width="hidden w-44 lg:block" className="min-w-0">
                      {isOpen(lead) && lead.nextAction ? (
                        <p className="truncate text-xs" title={lead.nextAction}>
                          {lead.nextActionOn ? (
                            <span
                              className={cn(
                                "mr-1 font-semibold",
                                follow === "overdue"
                                  ? "text-destructive"
                                  : follow === "today"
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-muted-foreground",
                              )}
                            >
                              {dueLabel(lead.nextActionOn)}
                            </span>
                          ) : null}
                          {lead.nextAction}
                        </p>
                      ) : isOpen(lead) ? (
                        <span className="text-xs text-muted-foreground/70">No next step</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/70">-</span>
                      )}
                    </DenseCell>
                    <DenseCell width="hidden w-28 md:block" className="truncate text-xs">
                      {lead.ownerUserId ? (
                        (memberName.get(lead.ownerUserId) ?? "Former teammate")
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </DenseCell>
                    <DenseCell align="right" width="hidden w-28 sm:block">
                      <StatusChip tone={stageTone(lead.stage, stages)}>
                        {stageLabel(lead.stage, stages)}
                      </StatusChip>
                    </DenseCell>
                    {seeMoney ? (
                      <DenseCell
                        align="right"
                        width="hidden w-28 md:block"
                        className="text-sm font-medium"
                      >
                        {lead.estimatedValueMinor != null
                          ? formatMoney({
                              amountMinor: lead.estimatedValueMinor,
                              currency: lead.currency,
                            })
                          : "-"}
                      </DenseCell>
                    ) : null}
                  </DenseRow>
                );
              })}
            </DenseListPanel>
          )}
        </IndexBody>
      )}

      <CrmLeadSheet
        orgSlug={orgSlug}
        leads={leads}
        initialLead={selected}
        stages={stages}
        canWrite={ctx.canWrite}
        canDelete={canDelete}
        showMoney={seeMoney}
        settings={settings}
        members={members}
        currentUserId={ctx.userId}
        sender={leadEmailSender(ctx)}
      />
    </WorkSurface>
  );
}
