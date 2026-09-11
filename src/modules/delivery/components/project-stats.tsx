"use client";

import { SoftCard } from "@/components/studio/chrome";
import { MoneyDonut, MoneyMetaCards, MONEY_COLORS } from "@/components/studio/money-donut";

export function ProjectStats({
  totalLabel,
  totalValue,
  dueValue,
  collectedValue,
  remainingValue,
  monthDueValue,
  dueMinor,
  collectedMinor,
  remainingMinor,
  unbilledValue,
  hint,
}: {
  totalLabel: string;
  totalValue: string;
  dueValue: string;
  collectedValue: string;
  remainingValue: string;
  monthDueValue: string;
  dueMinor: number;
  collectedMinor: number;
  remainingMinor: number;
  unbilledValue: string;
  hint?: string;
}) {
  const unbilledMinor = Math.max(0, remainingMinor - dueMinor);
  const slices = [
    {
      key: "collected",
      label: `Collected · ${collectedValue}`,
      value: Math.max(0, collectedMinor),
      color: MONEY_COLORS.collected,
    },
    {
      key: "due",
      label: `Due · ${dueValue}`,
      value: Math.max(0, dueMinor),
      color: MONEY_COLORS.due,
    },
    {
      key: "unbilled",
      label: `Unbilled · ${unbilledValue}`,
      value: unbilledMinor,
      color: MONEY_COLORS.remaining,
    },
  ].filter((slice) => slice.value > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SoftCard className="bg-linear-to-br from-slate-50 to-white p-5 shadow-soft">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {totalLabel}
          </p>
          <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{totalValue}</p>
          {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
        </SoftCard>
        <SoftCard className="bg-linear-to-br from-sky-50 to-white p-5 shadow-soft">
          <p className="text-[11px] font-medium tracking-wide text-sky-700/70 uppercase">Due</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{dueValue}</p>
          <p className="mt-2 text-sm text-muted-foreground">Open on the ledger</p>
        </SoftCard>
        <SoftCard className="bg-linear-to-br from-emerald-50 to-white p-5 shadow-soft">
          <p className="text-[11px] font-medium tracking-wide text-emerald-700/70 uppercase">
            Collected
          </p>
          <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{collectedValue}</p>
          <p className="mt-2 text-sm text-muted-foreground">Allocated receipts</p>
        </SoftCard>
        <SoftCard className="bg-linear-to-br from-violet-50 to-white p-5 shadow-soft">
          <p className="text-[11px] font-medium tracking-wide text-violet-700/70 uppercase">
            Remaining
          </p>
          <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{remainingValue}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This month {monthDueValue}
          </p>
        </SoftCard>
      </div>

      <SoftCard className="p-6 shadow-soft">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <p className="text-base font-semibold tracking-tight">Collection mix</p>
              <p className="mt-1 text-sm text-muted-foreground">
                How contracted money sits across collected, due, and still unbilled.
              </p>
            </div>
            <MoneyMetaCards
              className="grid-cols-2 sm:grid-cols-4"
              items={[
                { label: "Due", value: dueValue, tone: "sky" },
                { label: "Collected", value: collectedValue, tone: "emerald" },
                { label: "Remaining", value: remainingValue, tone: "violet" },
                { label: "This month", value: monthDueValue, tone: "amber" },
              ]}
            />
          </div>
          <div className="flex shrink-0 justify-center rounded-[1.75rem] bg-muted/50 px-6 py-5 lg:w-80">
            <MoneyDonut
              slices={
                slices.length > 0
                  ? slices
                  : [
                      {
                        key: "empty",
                        label: "No money yet",
                        value: 1,
                        color: MONEY_COLORS.muted,
                      },
                    ]
              }
              centerValue={totalValue}
              centerLabel="Total"
              size="lg"
              showLegend
              className="w-full max-w-sm"
            />
          </div>
        </div>
      </SoftCard>
    </div>
  );
}
