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
import { CrmLeadSheet } from "@/modules/crm/components/crm-lead-sheet";
import { getLead, listLeads } from "@/modules/crm/queries";
import { LEAD_STAGE_LABELS } from "@/modules/crm/types";
import { requireOrg } from "@/modules/identity/org";
import { JOURNEY } from "@/shared/journey-copy";
import { formatMoney } from "@/shared/money";

export default async function CrmPage({
  params,
  searchParams,
}: PageProps<"/[orgSlug]/crm">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.crm) notFound();

  const view = query.view === "list" ? "list" : "board";
  const q = typeof query.q === "string" ? query.q : "";
  const leadId = typeof query.lead === "string" ? query.lead : undefined;

  const [leads, selected] = await Promise.all([
    listLeads(orgSlug, { q: q || undefined }),
    leadId ? getLead(orgSlug, leadId) : Promise.resolve(null),
  ]);

  const openLeads = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const won = leads.filter((l) => l.stage === "won").length;
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
              <CreateLeadDialog
                orgSlug={orgSlug}
                defaultOpen={query.new === "1"}
                defaultCurrency={ctx.org.defaultCurrency}
              />
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
              canWrite={ctx.canWrite}
              activeLeadId={leadId}
            />
          )}
        </div>
      ) : (
        <IndexBody>
          {leads.length > 0 ? (
            <SummaryStrip>
              <SummaryStat label="Open" value={String(openLeads.length)} tone="sky" />
              <SummaryStat
                label="Pipeline"
                value={formatMoney({ amountMinor: pipelineValue, currency })}
                hint="Estimated value"
                tone="amber"
              />
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
                  <span className="w-28 text-right">Stage</span>
                  <span className="w-28 text-right">Value</span>
                </>
              }
              footer="Win a lead, then Become a client — no retyping."
            >
              {leads.map((lead) => (
                <DenseRow key={lead.id}>
                  <DenseCell className="min-w-0 flex-1">
                    <Link
                      href={`/${orgSlug}/crm?view=list&lead=${lead.id}`}
                      className="block min-w-0"
                    >
                      <p className="truncate text-sm font-medium">{lead.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[lead.company, lead.email, lead.source]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </Link>
                  </DenseCell>
                  <DenseCell align="right" width="w-28">
                    <StatusChip>{LEAD_STAGE_LABELS[lead.stage]}</StatusChip>
                  </DenseCell>
                  <DenseCell align="right" width="w-28" className="text-sm font-medium">
                    {lead.estimatedValueMinor != null
                      ? formatMoney({
                          amountMinor: lead.estimatedValueMinor,
                          currency: lead.currency,
                        })
                      : "—"}
                  </DenseCell>
                </DenseRow>
              ))}
            </DenseListPanel>
          )}
        </IndexBody>
      )}

      <CrmLeadSheet
        orgSlug={orgSlug}
        lead={selected}
        canWrite={ctx.canWrite}
        view={view}
      />
    </WorkSurface>
  );
}
