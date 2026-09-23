"use client";

import { cn } from "@/lib/utils";
import { initials } from "@/modules/finance/presentation";

/** Saturated avatar fills — readable initials, not washed pastels. */
const AVATAR_TONES = [
  "bg-sky-500 text-white",
  "bg-violet-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-500 text-amber-950",
  "bg-rose-500 text-white",
  "bg-cyan-600 text-white",
  "bg-fuchsia-600 text-white",
  "bg-indigo-600 text-white",
] as const;

function avatarTone(name: string) {
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

export function AvatarMark({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  /** Profile image URL — falls back to initials when missing or broken. */
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const label = name.trim() || "?";
  const sizeClass =
    size === "sm"
      ? "size-7 text-[11px] font-bold"
      : size === "lg"
        ? "size-12 text-sm font-bold"
        : "size-10 text-xs font-bold";

  if (src) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-card",
          sizeClass,
          className,
        )}
        title={label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            const fallback = event.currentTarget.nextElementSibling;
            if (fallback instanceof HTMLElement) fallback.hidden = false;
          }}
        />
        <span
          hidden
          className={cn(
            "absolute inset-0 inline-flex items-center justify-center tracking-tight",
            avatarTone(label),
          )}
        >
          {initials(label)}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full tracking-tight shadow-sm",
        avatarTone(label),
        sizeClass,
        className,
      )}
      title={label}
    >
      {initials(label)}
    </span>
  );
}

export function AvatarStack({
  people,
  size = "sm",
  max = 3,
  className,
}: {
  people: { name: string; src?: string | null }[];
  size?: "sm" | "md";
  max?: number;
  className?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const overlap = size === "sm" ? "-space-x-2" : "-space-x-2.5";

  return (
    <div className={cn("flex shrink-0 items-center", overlap, className)}>
      {shown.map((person, index) => (
        <AvatarMark
          key={`${person.name}-${index}`}
          name={person.name}
          src={person.src}
          size={size}
          className="ring-2 ring-card"
        />
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white ring-2 ring-card",
            size === "sm" ? "size-7" : "size-10",
          )}
          title={`${extra} more`}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

/** Always-visible avatar stack for multi-select filters. */
export function AvatarFilterStack({
  people,
  selectedIds,
  onToggle,
  size = "md",
  className,
}: {
  people: { id: string; name: string; src?: string | null }[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  if (people.length === 0) return null;
  const anySelected = selectedIds.size > 0;
  const overlap = size === "sm" ? "-space-x-2" : "-space-x-2.5";

  return (
    <div
      role="group"
      aria-label="Filter by assignee"
      className={cn("flex shrink-0 items-center", overlap, className)}
    >
      {people.map((person) => {
        const selected = selectedIds.has(person.id);
        const dimmed = anySelected && !selected;
        return (
          <button
            key={person.id}
            type="button"
            title={person.name}
            aria-pressed={selected}
            onClick={() => onToggle(person.id)}
            className={cn(
              "relative rounded-full transition-[transform,opacity,box-shadow] duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "z-10 scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background"
                : "ring-2 ring-card hover:z-10 hover:scale-105",
              dimmed && "opacity-35 hover:opacity-75",
            )}
          >
            <AvatarMark name={person.name} src={person.src} size={size} />
          </button>
        );
      })}
    </div>
  );
}
