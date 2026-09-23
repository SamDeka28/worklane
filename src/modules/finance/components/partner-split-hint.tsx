import { moneyLabel } from "@/modules/finance/ledger";
import { cn } from "@/lib/utils";

export const SPLIT_TONES = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
] as const;

export function splitToneIndex(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return sum % SPLIT_TONES.length;
}

export function pctLabel(shareBps: number) {
  return `${(shareBps / 100).toFixed(shareBps % 100 === 0 ? 0 : 1)}%`;
}

export type PartnerSplitVisualLine = {
  partnerId: string;
  partnerName: string;
  shareBps: number;
  amountLabel: string;
};

/** Compact stacked bar + chip legend (inline contexts). */
export function PartnerSplitVisual({
  lines,
  className,
}: {
  lines: PartnerSplitVisualLine[];
  className?: string;
}) {
  if (lines.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <SplitBar lines={lines} />
      <ul className="flex flex-wrap gap-1.5">
        {lines.map((line) => (
          <li
            key={line.partnerId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs ring-1 ring-foreground/5 dark:ring-white/8"
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                SPLIT_TONES[splitToneIndex(line.partnerName)],
              )}
            />
            <span className="font-medium text-foreground">{line.partnerName}</span>
            <span className="tabular-nums text-muted-foreground">
              {pctLabel(line.shareBps)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SplitBar({
  lines,
  className,
}: {
  lines: PartnerSplitVisualLine[];
  className?: string;
}) {
  return (
    <div
      className={cn("flex h-2.5 overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label="Partner split"
    >
      {lines.map((line) => (
        <span
          key={line.partnerId}
          className={cn(
            "h-full min-w-1.5 first:rounded-l-full last:rounded-r-full",
            SPLIT_TONES[splitToneIndex(line.partnerName)],
          )}
          style={{ width: `${Math.max(3, line.shareBps / 100)}%` }}
          title={`${line.partnerName} ${pctLabel(line.shareBps)}`}
        />
      ))}
    </div>
  );
}

/** Roomier row layout for the details dialog. */
export function PartnerSplitRows({
  lines,
  className,
}: {
  lines: PartnerSplitVisualLine[];
  className?: string;
}) {
  if (lines.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <SplitBar lines={lines} />
      <ul className="space-y-1.5">
        {lines.map((line) => (
          <li
            key={line.partnerId}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  SPLIT_TONES[splitToneIndex(line.partnerName)],
                )}
              />
              <span className="truncate font-medium">{line.partnerName}</span>
            </div>
            <span className="w-14 text-right tabular-nums text-muted-foreground">
              {pctLabel(line.shareBps)}
            </span>
            <span className="min-w-[5.5rem] text-right font-medium tabular-nums">
              {line.amountLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Server helper: format share lines for client dialogs. */
export function formatSplitVisualLines(
  lines: {
    partnerId: string;
    partnerName: string;
    shareBps: number;
    earnedMinor: bigint;
    currency: Parameters<typeof moneyLabel>[1];
  }[],
): PartnerSplitVisualLine[] {
  return lines.map((line) => ({
    partnerId: line.partnerId,
    partnerName: line.partnerName,
    shareBps: line.shareBps,
    amountLabel: moneyLabel(line.earnedMinor, line.currency),
  }));
}
