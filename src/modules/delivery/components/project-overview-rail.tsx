import Link from "next/link";
import { AvatarMark } from "@/components/studio/chrome";
import { MONEY_COLORS, MoneyDonut } from "@/components/studio/money-donut";
import { Meter } from "@/components/studio/meter";
import { moneyLabel } from "@/modules/finance/ledger";

type Money = {
  totalPriceMinor: bigint;
  outstandingMinor: bigint;
  collectedMinor: bigint;
  remainingMinor: bigint;
};

type SplitRow = {
  partnerId: string;
  name: string;
  earnedMinor: bigint;
};

export function ProjectOverviewRail({
  currency,
  money,
  feeBps,
  feeMinor,
  netTotalMinor,
  poolAmountMinor,
  totalEarnedMinor,
  splitRows,
  splitHref,
}: {
  currency: "USD" | "INR";
  money: Money;
  feeBps: number;
  feeMinor: bigint;
  netTotalMinor: bigint;
  poolAmountMinor: bigint | null;
  totalEarnedMinor: bigint;
  splitRows: SplitRow[];
  splitHref: string;
}) {
  const collected = Number(money.collectedMinor);
  const due = Number(money.outstandingMinor);
  const leftover = Math.max(0, Number(money.remainingMinor) - due);
  const total = Number(money.totalPriceMinor);
  const collectedRatio = total > 0 ? collected / total : 0;
  const feeLabel =
    feeBps > 0
      ? `Platform fee (${(feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2)}%)`
      : "Platform fee";

  const slices = [
    {
      key: "collected",
      label: `Collected · ${moneyLabel(money.collectedMinor, currency)}`,
      value: Math.max(0, collected),
      color: MONEY_COLORS.collected,
    },
    {
      key: "due",
      label: `Due · ${moneyLabel(money.outstandingMinor, currency)}`,
      value: Math.max(0, due),
      color: MONEY_COLORS.due,
    },
    {
      key: "left",
      label: `Left · ${moneyLabel(BigInt(leftover), currency)}`,
      value: leftover,
      color: MONEY_COLORS.remaining,
    },
  ];

  return (
    <aside className="w-full min-w-0 lg:sticky lg:top-0">
      <div className="overflow-hidden rounded-[1.75rem] bg-card shadow-soft ring-1 ring-border/30">
        <section className="px-5 pt-5 pb-5">
          <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Project value
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
            {money.totalPriceMinor > BigInt(0)
              ? moneyLabel(money.totalPriceMinor, currency)
              : "-"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Client total</p>

          {money.totalPriceMinor > BigInt(0) ? (
            <>
              <div className="mt-5">
                <MoneyDonut
                  slices={slices}
                  centerValue={`${Math.round(collectedRatio * 100)}%`}
                  centerLabel="Collected"
                  size="md"
                  showLegend
                />
              </div>
              <div className="mt-4 space-y-1.5">
                <Meter
                  value={collectedRatio}
                  tone={money.outstandingMinor > BigInt(0) ? "default" : "paid"}
                />
                <p className="text-xs tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground/85">
                    {moneyLabel(money.collectedMinor, currency)}
                  </span>
                  {" of "}
                  {moneyLabel(money.totalPriceMinor, currency)} collected
                </p>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Contract value appears once milestones or a total are set.
            </p>
          )}
        </section>

        {money.totalPriceMinor > BigInt(0) ? (
          <section className="space-y-2.5 border-t border-border/35 px-5 py-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{feeLabel}</span>
              <span className="tabular-nums text-muted-foreground">
                {feeMinor > BigInt(0)
                  ? `−${moneyLabel(feeMinor, currency)}`
                  : moneyLabel(BigInt(0), currency)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Distributable</span>
              <span className="font-semibold tabular-nums">
                {moneyLabel(netTotalMinor, currency)}
              </span>
            </div>
            {poolAmountMinor != null && netTotalMinor > BigInt(0) ? (
              <div className="pt-1">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Build pool</span>
                  <span className="tabular-nums">
                    {moneyLabel(poolAmountMinor, currency)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Meter
                    value={Number(poolAmountMinor) / Math.max(1, Number(netTotalMinor))}
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <Link
          href={splitHref}
          className="block border-t border-border/35 px-5 py-4 transition-colors hover:bg-muted/25"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              Split
            </p>
            <span className="text-xs font-medium text-sky-700">View</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">Earned to date</span>
            <span className="text-base font-semibold tabular-nums tracking-tight">
              {moneyLabel(totalEarnedMinor, currency)}
            </span>
          </div>
          {splitRows.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {splitRows.slice(0, 4).map((row) => (
                <li key={row.partnerId} className="flex items-center gap-2.5">
                  <AvatarMark name={row.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {moneyLabel(row.earnedMinor, currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Partner earnings appear here once the split is set and charges allocate.
            </p>
          )}
        </Link>
      </div>
    </aside>
  );
}
