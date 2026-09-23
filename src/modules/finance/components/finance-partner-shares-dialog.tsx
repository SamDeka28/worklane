"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MONEY_COLORS, MoneyDonut } from "@/components/studio/money-donut";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  PartnerSplitRows,
  type PartnerSplitVisualLine,
} from "@/modules/finance/components/partner-split-hint";
import { cn } from "@/lib/utils";

export type PartnerSharesChargeDetail = {
  chargeId: string;
  memo: string;
  clientName: string;
  grossLabel: string;
  lines: PartnerSplitVisualLine[];
};

export type PartnerSharesPartnerDetail = {
  partnerId: string;
  partnerName: string;
  earnedLabel: string;
  settledLabel: string;
  payableLabel: string;
  earnedValue: number;
  settledValue: number;
  payableValue: number;
};

export type PartnerSharesMonthDetail = {
  earnedLabel: string;
  settledLabel: string;
  payableLabel: string;
  earnedValue: number;
  settledValue: number;
  payableValue: number;
};

type PartnerBarDatum = {
  name: string;
  earned: number;
  settled: number;
  payable: number;
  earnedLabel: string;
  settledLabel: string;
  payableLabel: string;
};

function PartnerBarsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: PartnerBarDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg bg-card px-3 py-2 text-xs shadow-lift ring-1 ring-border/50">
      <p className="font-medium">{row.name}</p>
      <ul className="mt-1.5 space-y-1 text-muted-foreground">
        <li className="flex justify-between gap-4">
          <span>Earned</span>
          <span className="tabular-nums text-foreground">{row.earnedLabel}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Settled</span>
          <span className="tabular-nums text-foreground">{row.settledLabel}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>To pay</span>
          <span className="tabular-nums text-foreground">{row.payableLabel}</span>
        </li>
      </ul>
    </div>
  );
}

function formatAxisMoney(value: number) {
  if (!Number.isFinite(value) || value === 0) return "$0";
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return `$${Math.round(value)}`;
}

export function PartnerSharesDetailDialog({
  month,
  partners,
  charges,
  triggerLabel = "View split details",
}: {
  month?: PartnerSharesMonthDetail | null;
  partners: PartnerSharesPartnerDetail[];
  charges: PartnerSharesChargeDetail[];
  triggerLabel?: string;
}) {
  if (partners.length === 0 && charges.length === 0 && !month) return null;

  const partnerBars: PartnerBarDatum[] = partners.map((row) => ({
    name: row.partnerName,
    earned: Math.max(0, row.earnedValue) / 100,
    settled: Math.max(0, row.settledValue) / 100,
    payable: Math.max(0, row.payableValue) / 100,
    earnedLabel: row.earnedLabel,
    settledLabel: row.settledLabel,
    payableLabel: row.payableLabel,
  }));

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[min(90vh,52rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/15 px-6 py-5 pr-12">
          <DialogTitle className="font-heading text-xl tracking-tight">
            Partner split details
          </DialogTitle>
          <DialogDescription className="text-sm">
            What partners earned this period, what you settled, and how each charge splits.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {month ? (
            <section>
              <SectionLabel>Overview</SectionLabel>
              <div className="mt-3 flex flex-col gap-5 lane-inset px-4 py-5 sm:flex-row sm:items-center sm:px-5">
                <MoneyDonut
                  size="md"
                  className="sm:min-w-56"
                  centerLabel="Earned"
                  centerValue={month.earnedLabel}
                  slices={[
                    {
                      key: "collected",
                      label: `Settled · ${month.settledLabel}`,
                      value: month.settledValue,
                      color: MONEY_COLORS.collected,
                    },
                    {
                      key: "due",
                      label: `Still to pay · ${month.payableLabel}`,
                      value: month.payableValue,
                      color: MONEY_COLORS.due,
                    },
                  ]}
                />
                <div className="grid min-w-0 flex-1 gap-2">
                  <OverviewStat label="Partners earned" value={month.earnedLabel} />
                  <OverviewStat label="Settled" value={month.settledLabel} />
                  <OverviewStat
                    label="Still to pay"
                    value={month.payableLabel}
                    emphasize
                  />
                </div>
              </div>
            </section>
          ) : null}

          {partners.length > 0 ? (
            <section className="space-y-3">
              <SectionLabel>By partner</SectionLabel>
              <div className="rounded-2xl px-3 py-4 ring-1 ring-foreground/5 dark:ring-white/6 sm:px-4">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-violet-400" />
                    Earned
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400" />
                    Settled
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-sky-400" />
                    To pay
                  </span>
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={partnerBars}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      barCategoryGap="32%"
                      barGap={3}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="currentColor"
                        className="text-border/40"
                        strokeDasharray="4 6"
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "currentColor", fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        tick={{ fill: "currentColor", fontSize: 11 }}
                        className="text-muted-foreground"
                        tickFormatter={formatAxisMoney}
                      />
                      <Tooltip
                        cursor={{
                          fill: "currentColor",
                          className: "text-muted/40",
                          opacity: 0.3,
                        }}
                        content={<PartnerBarsTooltip />}
                        wrapperStyle={{ outline: "none", zIndex: 40 }}
                      />
                      <Bar
                        dataKey="earned"
                        name="Earned"
                        fill="#8b7cf8"
                        radius={[5, 5, 2, 2]}
                        maxBarSize={22}
                      />
                      <Bar
                        dataKey="settled"
                        name="Settled"
                        fill="#34d399"
                        radius={[5, 5, 2, 2]}
                        maxBarSize={22}
                      />
                      <Bar
                        dataKey="payable"
                        name="To pay"
                        fill="#38bdf8"
                        radius={[5, 5, 2, 2]}
                        maxBarSize={22}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-4 divide-y divide-border/15 border-t border-border/15">
                  {partners.map((row) => (
                    <li
                      key={row.partnerId}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm"
                    >
                      <span className="font-medium">{row.partnerName}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.earnedLabel} earned · {row.settledLabel} settled ·{" "}
                        <span className="font-semibold text-foreground">
                          {row.payableLabel} to pay
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {charges.length > 0 ? (
            <section className="space-y-3">
              <SectionLabel>By charge</SectionLabel>
              <ul className="space-y-3">
                {charges.map((charge) => (
                  <li
                    key={charge.chargeId}
                    className="rounded-2xl px-4 py-4 ring-1 ring-foreground/5 dark:ring-white/6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-heading text-base font-semibold tracking-tight">
                          {charge.memo}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {charge.clientName}
                        </p>
                      </div>
                      <p className="shrink-0 font-heading text-base font-semibold tabular-nums tracking-tight">
                        {charge.grossLabel}
                      </p>
                    </div>
                    <PartnerSplitRows lines={charge.lines} className="mt-4" />
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              No charge-level splits in this view yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function OverviewStat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card px-4 py-3 ring-1 ring-white/10",
        emphasize && "ring-primary/20",
      )}
    >
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-heading text-xl leading-none font-semibold tracking-tight tabular-nums",
          emphasize && "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}
