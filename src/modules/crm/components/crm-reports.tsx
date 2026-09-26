import type { ReactNode } from "react";
import { SummaryStat, SummaryStrip } from "@/components/studio/index-layout";
import { cn } from "@/lib/utils";
import type { LeadStageMove } from "@/modules/crm/queries";
import {
  isLostStage,
  isWonStage,
  openPipelineStages,
  stageProbabilityBps,
  type CrmMember,
  type LeadRecord,
  type LeadStageRecord,
} from "@/modules/crm/types";
import { formatMoney, type IsoCurrency } from "@/shared/money";

type Totals = Map<IsoCurrency, bigint>;

function add(totals: Totals, currency: IsoCurrency, amount: bigint) {
  totals.set(currency, (totals.get(currency) ?? BigInt(0)) + amount);
}

function formatTotals(totals: Totals, fallback: IsoCurrency) {
  const parts = [...totals.entries()]
    .filter(([, amount]) => amount !== BigInt(0))
    .map(([currency, amount]) => formatMoney({ amountMinor: amount, currency }));
  return parts.length > 0 ? parts.join(" + ") : formatMoney({ amountMinor: BigInt(0), currency: fallback });
}

/** Dominant-currency figure for bar widths; mixed currencies are rare. */
function primaryAmount(totals: Totals) {
  let best = BigInt(0);
  for (const amount of totals.values()) if (amount > best) best = amount;
  return Number(best);
}

function weighted(lead: LeadRecord, stage: LeadStageRecord | undefined, stages: LeadStageRecord[]) {
  if (lead.estimatedValueMinor == null || !stage) return BigInt(0);
  return (lead.estimatedValueMinor * BigInt(stageProbabilityBps(stage, stages))) / BigInt(10_000);
}

function monthKey(day: string) {
  return day.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function percent(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "-";
}

function Panel({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl bg-card p-4 ring-1 ring-foreground/8 sm:p-5", className)}>
      <header className="mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Bar({
  label,
  value,
  ratio,
  tone = "bg-primary/70",
  sub,
}: {
  label: string;
  value: string;
  ratio: number;
  tone?: string;
  sub?: string;
}) {
  return (
    <li className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">{label}</span>
        <span className="shrink-0 tabular-nums">
          {value}
          {sub ? <span className="ml-1.5 text-xs text-muted-foreground">{sub}</span> : null}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${Math.max(ratio > 0 ? 3 : 0, Math.min(100, ratio * 100))}%` }}
        />
      </div>
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export function CrmReports({
  leads,
  stages,
  moves,
  members,
  showMoney,
  currency,
}: {
  leads: LeadRecord[];
  stages: LeadStageRecord[];
  moves: LeadStageMove[];
  members: CrmMember[];
  showMoney: boolean;
  currency: IsoCurrency;
}) {
  const stageBySlug = new Map(stages.map((stage) => [stage.slug, stage]));
  const open = leads.filter(
    (lead) => !isWonStage(lead.stage, stages) && !isLostStage(lead.stage, stages),
  );
  const won = leads.filter((lead) => isWonStage(lead.stage, stages));
  const lost = leads.filter((lead) => isLostStage(lead.stage, stages));

  const pipeline: Totals = new Map();
  const forecast: Totals = new Map();
  for (const lead of open) {
    if (lead.estimatedValueMinor == null) continue;
    add(pipeline, lead.currency, lead.estimatedValueMinor);
    add(forecast, lead.currency, weighted(lead, stageBySlug.get(lead.stage), stages));
  }

  const wonTotals: Totals = new Map();
  for (const lead of won) {
    if (lead.estimatedValueMinor != null) add(wonTotals, lead.currency, lead.estimatedValueMinor);
  }

  const closedCount = won.length + lost.length;
  const cycleDays = won
    .filter((lead) => lead.closedAt)
    .map(
      (lead) =>
        (new Date(lead.closedAt as string).getTime() - new Date(lead.createdAt).getTime()) /
        86_400_000,
    );
  const avgCycle =
    cycleDays.length > 0
      ? Math.round(cycleDays.reduce((sum, days) => sum + days, 0) / cycleDays.length)
      : null;

  // Forecast by expected close month (weighted), next six months plus overdue / undated.
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const months: string[] = [];
  for (let offset = 0; offset < 6; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  const buckets = new Map<string, Totals>([["overdue", new Map()], ["undated", new Map()]]);
  for (const key of months) buckets.set(key, new Map());
  for (const lead of open) {
    if (lead.estimatedValueMinor == null) continue;
    const amount = weighted(lead, stageBySlug.get(lead.stage), stages);
    const key = !lead.closeOn
      ? "undated"
      : monthKey(lead.closeOn) < thisMonth
        ? "overdue"
        : monthKey(lead.closeOn);
    const bucket = buckets.get(key);
    if (bucket) add(bucket, lead.currency, amount);
  }
  const forecastRows = [
    ...(primaryAmount(buckets.get("overdue")!) > 0
      ? [{ key: "overdue", label: "Past close date" }]
      : []),
    ...months.map((key) => ({ key, label: monthLabel(key) })),
    ...(primaryAmount(buckets.get("undated")!) > 0 ? [{ key: "undated", label: "No close date" }] : []),
  ];
  const forecastMax = Math.max(1, ...forecastRows.map((row) => primaryAmount(buckets.get(row.key)!)));

  // Funnel: how far each lead has ever got, from its current stage and stage history.
  const funnelStages = [...openPipelineStages(stages), ...stages.filter((s) => s.systemKey === "won")];
  const furthest = new Map<string, number>();
  const reach = (leadId: string, slug: string) => {
    const stage = stageBySlug.get(slug);
    if (!stage || isLostStage(slug, stages)) return;
    furthest.set(leadId, Math.max(furthest.get(leadId) ?? -1, stage.position));
  };
  for (const lead of leads) {
    reach(lead.id, lead.stage);
    if (!furthest.has(lead.id)) furthest.set(lead.id, funnelStages[0]?.position ?? 0);
  }
  for (const move of moves) if (furthest.has(move.leadId)) reach(move.leadId, move.to);
  const funnel = funnelStages.map((stage) => ({
    stage,
    count: [...furthest.values()].filter((position) => position >= stage.position).length,
  }));
  const funnelTop = Math.max(1, funnel[0]?.count ?? 1);

  // By source.
  const sources = new Map<string, { total: number; won: number; lost: number; value: Totals }>();
  for (const lead of leads) {
    const key = lead.source?.trim() || "Unknown";
    const row = sources.get(key) ?? { total: 0, won: 0, lost: 0, value: new Map() };
    row.total++;
    if (isWonStage(lead.stage, stages)) {
      row.won++;
      if (lead.estimatedValueMinor != null) add(row.value, lead.currency, lead.estimatedValueMinor);
    }
    if (isLostStage(lead.stage, stages)) row.lost++;
    sources.set(key, row);
  }
  const sourceRows = [...sources.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  const sourceMax = Math.max(1, ...sourceRows.map(([, row]) => row.total));

  // Lost reasons.
  const reasons = new Map<string, number>();
  for (const lead of lost) {
    const key = lead.lostReason?.trim() || "No reason given";
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  const reasonRows = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  const reasonMax = Math.max(1, ...reasonRows.map(([, count]) => count));

  // By owner.
  const memberName = new Map(members.map((member) => [member.userId, member.name]));
  const owners = new Map<string, { open: number; won: number; lost: number; pipeline: Totals }>();
  for (const lead of leads) {
    const key = lead.ownerUserId ?? "none";
    const row = owners.get(key) ?? { open: 0, won: 0, lost: 0, pipeline: new Map() };
    if (isWonStage(lead.stage, stages)) row.won++;
    else if (isLostStage(lead.stage, stages)) row.lost++;
    else {
      row.open++;
      if (lead.estimatedValueMinor != null) add(row.pipeline, lead.currency, lead.estimatedValueMinor);
    }
    owners.set(key, row);
  }
  const ownerRows = [...owners.entries()].sort((a, b) => b[1].open - a[1].open);

  if (leads.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Empty>Reports fill in as leads move through the pipeline.</Empty>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6 sm:px-6 sm:pt-4">
      <div className="mx-auto grid max-w-6xl gap-4">
        <SummaryStrip>
          {showMoney ? (
            <SummaryStat
              label="Weighted forecast"
              value={formatTotals(forecast, currency)}
              hint={`of ${formatTotals(pipeline, currency)} open`}
              tone="sky"
            />
          ) : (
            <SummaryStat label="Open leads" value={String(open.length)} tone="sky" />
          )}
          <SummaryStat
            label="Win rate"
            value={percent(won.length, closedCount)}
            hint={`${won.length} won · ${lost.length} lost`}
            tone="emerald"
          />
          <SummaryStat
            label="Days to close"
            value={avgCycle == null ? "-" : String(avgCycle)}
            hint="Average for won deals"
            tone="amber"
          />
          {showMoney ? (
            <SummaryStat
              label="Won value"
              value={formatTotals(wonTotals, currency)}
              hint={won.length ? `${won.length} deal${won.length === 1 ? "" : "s"}` : undefined}
              tone="slate"
            />
          ) : (
            <SummaryStat label="Won" value={String(won.length)} tone="slate" />
          )}
        </SummaryStrip>

        <div className="grid gap-4 lg:grid-cols-2">
          {showMoney ? (
            <Panel
              title="Forecast by close month"
              hint="Estimated value × stage win probability, by expected close date."
            >
              <ul className="grid gap-3">
                {forecastRows.map((row) => {
                  const totals = buckets.get(row.key)!;
                  return (
                    <Bar
                      key={row.key}
                      label={row.label}
                      value={formatTotals(totals, currency)}
                      ratio={primaryAmount(totals) / forecastMax}
                      tone={
                        row.key === "overdue"
                          ? "bg-rose-400"
                          : row.key === "undated"
                            ? "bg-muted-foreground/40"
                            : "bg-sky-500/80"
                      }
                    />
                  );
                })}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Pipeline funnel" hint="Leads that reached each stage, from stage history.">
            <ul className="grid gap-3">
              {funnel.map(({ stage, count }, index) => (
                <Bar
                  key={stage.id}
                  label={stage.name}
                  value={String(count)}
                  sub={index > 0 ? percent(count, funnel[index - 1].count) : undefined}
                  ratio={count / funnelTop}
                  tone={stage.systemKey === "won" ? "bg-emerald-500/80" : "bg-violet-500/70"}
                />
              ))}
            </ul>
          </Panel>

          <Panel title="By source" hint="Where leads come from, and which sources convert.">
            {sourceRows.length === 0 ? (
              <Empty>No sources yet.</Empty>
            ) : (
              <ul className="grid gap-3">
                {sourceRows.map(([source, row]) => (
                  <Bar
                    key={source}
                    label={source}
                    value={`${row.total}`}
                    sub={
                      row.won + row.lost > 0
                        ? `${percent(row.won, row.won + row.lost)} win${
                            showMoney && row.won ? ` · ${formatTotals(row.value, currency)}` : ""
                          }`
                        : undefined
                    }
                    ratio={row.total / sourceMax}
                    tone="bg-amber-500/70"
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Why deals are lost" hint="Reasons picked when moving a lead to Lost.">
            {reasonRows.length === 0 ? (
              <Empty>No lost deals yet.</Empty>
            ) : (
              <ul className="grid gap-3">
                {reasonRows.map(([reason, count]) => (
                  <Bar
                    key={reason}
                    label={reason}
                    value={String(count)}
                    sub={percent(count, lost.length)}
                    ratio={count / reasonMax}
                    tone="bg-rose-400/80"
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="By owner" className="lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Owner</th>
                    <th className="pb-2 text-right font-medium">Open</th>
                    {showMoney ? <th className="pb-2 text-right font-medium">Pipeline</th> : null}
                    <th className="pb-2 text-right font-medium">Won</th>
                    <th className="pb-2 text-right font-medium">Lost</th>
                    <th className="pb-2 text-right font-medium">Win rate</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {ownerRows.map(([owner, row]) => (
                    <tr key={owner} className="border-t border-border/50">
                      <td className="py-2 font-medium">
                        {owner === "none" ? (
                          <span className="text-muted-foreground">Unassigned</span>
                        ) : (
                          (memberName.get(owner) ?? "Former teammate")
                        )}
                      </td>
                      <td className="py-2 text-right">{row.open}</td>
                      {showMoney ? (
                        <td className="py-2 text-right">{formatTotals(row.pipeline, currency)}</td>
                      ) : null}
                      <td className="py-2 text-right">{row.won}</td>
                      <td className="py-2 text-right">{row.lost}</td>
                      <td className="py-2 text-right">{percent(row.won, row.won + row.lost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
