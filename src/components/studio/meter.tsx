import { cn } from "@/lib/utils";

export function Meter({
  value,
  tone = "default",
}: {
  value: number;
  tone?: "default" | "overdue" | "paid";
}) {
  const width = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full",
          tone === "overdue"
            ? "bg-destructive"
            : tone === "paid"
              ? "bg-lane-cyan"
              : "bg-primary",
        )}
        style={{ width }}
      />
    </div>
  );
}
