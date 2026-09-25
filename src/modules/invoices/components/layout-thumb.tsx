import { cn } from "@/lib/utils";
import { INVOICE_INK, invoiceLayoutSpec } from "@/modules/invoices/layouts";

/** A tiny sketch of an invoice look, drawn from its layout spec. */
export function InvoiceLayoutThumb({
  layout,
  accent,
  className,
}: {
  layout: string;
  accent: string;
  className?: string;
}) {
  const spec = invoiceLayoutSpec(layout);
  const bandColor = spec.band === "ink" ? INVOICE_INK : accent;
  const headStyle =
    spec.tableHead === "accent"
      ? { backgroundColor: accent }
      : spec.tableHead === "ink"
        ? { backgroundColor: INVOICE_INK }
        : spec.tableHead === "tint"
          ? { backgroundColor: `${accent}22` }
          : undefined;

  return (
    <div
      className={cn(
        "relative flex aspect-[4/5] flex-col overflow-hidden rounded-lg bg-white ring-1 ring-black/5",
        className,
      )}
    >
      {spec.topBar ? <div className="h-1 shrink-0" style={{ backgroundColor: accent }} /> : null}
      {spec.sideBar ? (
        <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} />
      ) : null}

      {spec.header === "band" ? (
        <div className="shrink-0">
          <div className="flex h-6 items-center justify-between px-2" style={{ backgroundColor: bandColor }}>
            <span className="h-2.5 w-4 rounded-[2px] bg-white" />
            <span className="h-1.5 w-6 rounded-full bg-white/80" />
          </div>
          {spec.band === "ink" ? <div className="h-[3px]" style={{ backgroundColor: accent }} /> : null}
        </div>
      ) : spec.header === "block" ? (
        <div className="flex shrink-0 items-stretch justify-between pl-2">
          <span className="mt-3 h-2.5 w-5 rounded-[2px] bg-slate-300" />
          <span className="h-7 w-2/5 rounded-bl-lg" style={{ backgroundColor: accent }} />
        </div>
      ) : spec.header === "letterhead" ? (
        <div className="flex shrink-0 flex-col items-center px-2 pt-2.5">
          <span className="h-2.5 w-5 rounded-[2px] bg-slate-300" />
          <span className="mt-1.5 h-[2px] w-full" style={{ backgroundColor: accent }} />
          <span className="mt-px h-px w-full" style={{ backgroundColor: accent }} />
        </div>
      ) : spec.header === "ribbon" ? (
        <div className="flex shrink-0 items-start justify-between px-2 pt-2.5">
          <span className="h-2 w-7 rounded-full" style={{ backgroundColor: accent }} />
          <span className="h-2.5 w-5 rounded-[2px] bg-slate-300" />
        </div>
      ) : spec.header === "centered" ? (
        <div className="flex shrink-0 flex-col items-center gap-1 px-2 pt-2.5">
          <span className="h-2.5 w-5 rounded-[2px] bg-slate-300" />
          <span className="flex items-center gap-1">
            <span className="h-px w-3" style={{ backgroundColor: accent }} />
            <span className="h-1 w-5 rounded-full" style={{ backgroundColor: accent }} />
            <span className="h-px w-3" style={{ backgroundColor: accent }} />
          </span>
        </div>
      ) : (
        <div
          className="flex shrink-0 items-start justify-between px-2 pt-2.5 pb-1.5"
          style={
            spec.header === "tint"
              ? { backgroundColor: `color-mix(in srgb, ${accent} 10%, white)` }
              : undefined
          }
        >
          <span className="h-2.5 w-5 rounded-[2px] bg-slate-300" />
          <span
            className={cn("rounded-full", spec.title === "small" ? "h-1 w-5" : "h-2 w-8")}
            style={{
              backgroundColor: spec.title === "small" || spec.header === "tint" ? accent : "#334155",
            }}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col px-2 pt-2">
        <div
          className={cn(
            "mb-2 h-2.5 rounded-sm",
            spec.meta === "rules" ? "border-y border-slate-200" : "bg-slate-100",
          )}
        />
        <div className="mb-2 grid grid-cols-2 gap-2">
          <span className="h-1.5 rounded-full bg-slate-200" />
          <span className="h-1.5 rounded-full bg-slate-200" />
        </div>
        <div
          className={cn(
            "mb-1 h-2 rounded-[2px]",
            spec.tableHead === "rules" && "border-y-2 border-slate-800",
            spec.tableHead === "fine" && "border-y",
            spec.tableHead === "underline" && "border-b-2",
          )}
          style={{
            ...headStyle,
            ...(spec.tableHead === "fine" || spec.tableHead === "underline"
              ? { borderColor: accent }
              : {}),
          }}
        />
        <div className="mb-1 h-1 rounded-full bg-slate-100" />
        <div className="mb-1 h-1 rounded-full bg-slate-100" />
        <div className="mb-2 h-1 rounded-full bg-slate-100" />
        <div
          className={cn(
            "ml-auto h-2 w-2/5 rounded-[2px]",
            spec.due === "rule" && "border-t-2 border-slate-800",
            spec.due === "outline" && "border",
          )}
          style={
            spec.due === "rule"
              ? undefined
              : spec.due === "outline"
                ? { borderColor: accent }
                : { backgroundColor: spec.due === "ink" ? INVOICE_INK : accent }
          }
        />
      </div>

      {spec.serif ? (
        <span className="absolute right-1.5 bottom-1 font-serif text-[9px] text-slate-400 italic">Aa</span>
      ) : null}
      {spec.bottomBar ? <div className="h-1 shrink-0" style={{ backgroundColor: accent }} /> : null}
    </div>
  );
}
