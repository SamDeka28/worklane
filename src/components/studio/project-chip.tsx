import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Saturated project/category badges — readable on light and dark. */
const PROJECT_TONES = [
  "bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:bg-sky-400/20 dark:text-sky-200 dark:ring-sky-400/30",
  "bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-400/20 dark:text-emerald-200 dark:ring-emerald-400/30",
  "bg-amber-500/15 text-amber-800 ring-amber-500/25 dark:bg-amber-400/20 dark:text-amber-100 dark:ring-amber-400/30",
  "bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:bg-rose-400/20 dark:text-rose-200 dark:ring-rose-400/30",
  "bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:bg-violet-400/20 dark:text-violet-200 dark:ring-violet-400/30",
  "bg-cyan-500/15 text-cyan-800 ring-cyan-500/25 dark:bg-cyan-400/20 dark:text-cyan-100 dark:ring-cyan-400/30",
  "bg-orange-500/15 text-orange-800 ring-orange-500/25 dark:bg-orange-400/20 dark:text-orange-100 dark:ring-orange-400/30",
  "bg-fuchsia-500/15 text-fuchsia-700 ring-fuchsia-500/25 dark:bg-fuchsia-400/20 dark:text-fuchsia-200 dark:ring-fuchsia-400/30",
] as const;

const PROJECT_TEXT = [
  "text-sky-700 dark:text-sky-300",
  "text-emerald-700 dark:text-emerald-300",
  "text-amber-800 dark:text-amber-200",
  "text-rose-700 dark:text-rose-300",
  "text-violet-700 dark:text-violet-300",
  "text-cyan-800 dark:text-cyan-200",
  "text-orange-800 dark:text-orange-200",
  "text-fuchsia-700 dark:text-fuchsia-300",
] as const;

function toneIndex(label: string) {
  let sum = 0;
  for (const char of label) sum += char.charCodeAt(0);
  return sum % PROJECT_TONES.length;
}

export function projectToneClass(label: string) {
  return PROJECT_TONES[toneIndex(label)];
}

/** Color only, for text marks that should not wear a filled badge. */
export function projectTextClass(label: string) {
  return PROJECT_TEXT[toneIndex(label)];
}

export function ProjectChip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  if (!label.trim()) return null;
  return (
    <span
      title={label}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1 text-[11px] font-medium",
        projectTextClass(label),
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function TagRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
  );
}
