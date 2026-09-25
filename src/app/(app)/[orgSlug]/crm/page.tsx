import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
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
import { LeadJourneyConfig } from "@/modules/crm/components/lead-journey-config";
import { getLead, listLeads, listLeadStages } from "@/modules/crm/queries";
import {
  isClosedStage,
  isWonStage,
  stageLabel,
  stageTone,
  stagesOrDefault,
} from "@/modules/crm/types";
import { requireModuleAccess, requireOrg } from "@/modules/identity/org";
import { canDeleteModule, canSeeMoney } from "@/modules/identity/permissions";
import { JOURNEY } from "@/shared/journey-copy";
import { formatMoney } from "@/shared/money";

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

  const view = query.view === "list" ? "list" : "board";
  const q = typeof query.q === "string" ? query.q : "";
  const leadId = typeof query.lead === "string" ? query.lead : undefined;

  const [leads, selected, stageRows] = await Promise.all([
    listLeads(orgSlug, { q: q || undefined }),
    leadId ? getLead(orgSlug, leadId) : Promise.resolve(null),
    listLeadStages(orgSlug),
  ]);
  const stages = stagesOrDefault(stageRows);

  const openLeads = leads.filter((l) => !isClosedStage(l.stage, stages));
  const won = leads.filter((l) => isWonStage(l.stage, stages)).length;
  const pipelineValue = openLeads.reduce(
    (sum, lead) => sum + (lead.estimatedValueMinor ?? BigInt(0)),
    BigInt(0),
  );
  const currency = leads[0]?.currency ?? ctx.org.defaultCurrency;

  return (
    <WorkSurface>
      <StudioToolbar
        purpose={JOURNEY.leads.purpose}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-muted p-1">
              <Link
                href={`/${orgSlug}/crm?view=board`}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-full",
                  view === "board"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
                aria-label="Board view"
              >
                <LayoutGrid className="size-3.5" />
              </Link>
              <Link
                href={`/${orgSlug}/crm?view=list`}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-full",
                  view === "list"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
                aria-label="List view"
              >
                <List className="size-3.5" />
              </Link>
            </div>
            {ctx.canWrite ? (
              <>
                <LeadJourneyConfig
                  orgSlug={orgSlug}
                  stages={stages}
                  canWrite={ctx.canWrite}
                />
                <CreateLeadDialog
                  orgSlug={orgSlug}
                  stages={stages}
                  defaultCurrency={ctx.org.defaultCurrency}
                  showMoney={seeMoney}
                />
              </>
            ) : null}
          </div>
        }
      />

      {view === "board" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {leads.length === 0 ? (
            <EmptyState
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
                  value={formatMoney({ amountMinor: pipelineValue, currency })}
                  hint="Estimated value"
                  tone="amber"
                />
              ) : null}
              <SummaryStat label="Won" value={String(won)} tone="emerald" />
              <SummaryStat label="All" value={String(leads.length)} tone="slate" />
            </SummaryStrip>
          ) : null}
          <form className="shrink-0">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search leads…"
              className="h-9 w-full max-w-sm rounded-full border-0 bg-muted px-4 text-sm"
            />
            <input type="hidden" name="view" value="list" />
          </form>
          {leads.length === 0 ? (
            <EmptyState
              fill
              title={q ? "No leads match" : JOURNEY.leads.emptyTitle}
              body={q ? undefined : JOURNEY.leads.emptyBody}
              actionHref={ctx.canWrite && !q ? `/${orgSlug}/crm?new=1` : undefined}
              actionLabel={ctx.canWrite && !q ? JOURNEY.leads.primaryCta : undefined}
            />
          ) : (
            <DenseListPanel
              columns={
                <>
                  <span className="min-w-0 flex-1">Lead</span>
                  <span className="hidden w-28 text-right sm:block">Stage</span>
                  {seeMoney ? (
                    <span className="hidden w-28 text-right md:block">Value</span>
                  ) : null}
                </>
              }
              footer="Win a lead, then Become a client: no retyping."
            >
              {leads.map((lead) => (
                <DenseRow key={lead.id}>
                  <DenseCell className="min-w-0 flex-1">
                    <LeadOpenLink
                      leadId={lead.id}
                      href={`/${orgSlug}/crm?view=list&lead=${lead.id}`}
                      className="block min-w-0"
                    >
                      <p className="truncate text-sm font-medium">{lead.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[lead.company, lead.email, lead.source]
                          .filter(Boolean)
                          .join(" · ") || "-"}
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
              ))}
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
        canDelete={canDeleteModule(ctx, "crm")}
        showMoney={seeMoney}
      />
    </WorkSurface>
  );
}
