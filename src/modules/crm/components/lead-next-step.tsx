"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { setLeadNextActionAction } from "@/modules/crm/follow-actions";
import { addDays, dueLabel } from "@/modules/crm/presentation";
import { followState, todayIso, type LeadRecord } from "@/modules/crm/types";
function nextMonday() {
  const date = new Date();
  const offset = ((8 - date.getDay()) % 7) || 7;
  date.setDate(date.getDate() + offset);
  return todayIso(date);
}

const PRESETS = [
  { label: "Today", day: () => addDays(0) },
  { label: "Tomorrow", day: () => addDays(1) },
  { label: "In 3 days", day: () => addDays(3) },
  { label: "Next week", day: nextMonday },
];

/** Next step fields for the create form (saved with the lead). */
export function NextStepFields({ idPrefix }: { idPrefix: string }) {
  const [day, setDay] = useState(addDays(1));
  return (
    <div className="grid gap-3">
      <Input
        id={`${idPrefix}_next_action`}
        name="next_action"
        placeholder="e.g. Intro call, send proposal"
        maxLength={200}
        aria-label="Next step"
      />
      <DayPicker value={day} onChange={setDay} />
      <input type="hidden" name="next_action_on" value={day} />
    </div>
  );
}

function DayPicker({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((preset) => {
        const day = preset.day();
        const active = value === day;
        return (
          <button
            key={preset.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(day)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors",
              active
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground",
            )}
          >
            {preset.label}
          </button>
        );
      })}
      <input
        type="date"
        aria-label="Pick a date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-full bg-card px-3 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
    </div>
  );
}

/** Live next-step card on a saved lead: set, reschedule, complete, or clear. */
export function LeadNextStep({
  orgSlug,
  lead,
  canWrite,
}: {
  orgSlug: string;
  lead: LeadRecord;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!lead.nextAction);
  const [text, setText] = useState(lead.nextAction ?? "");
  const [day, setDay] = useState(lead.nextActionOn ?? addDays(1));
  const state = followState(lead);

  function save(input: { text: string; on: string | null; done?: boolean }, message: string) {
    start(async () => {
      const result = await setLeadNextActionAction(orgSlug, lead.id, input);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      if (input.done || !input.text) {
        setText("");
        setDay(addDays(1));
        setEditing(true);
      } else {
        setEditing(false);
      }
      router.refresh();
    });
  }

  const tone =
    state === "overdue"
      ? "bg-status-overdue/60 ring-status-overdue-fg/25"
      : state === "today"
        ? "bg-amber-500/10 ring-amber-500/25"
        : "bg-muted/40 ring-foreground/6";

  if (!canWrite && !lead.nextAction) return null;

  return (
    <section className={cn("rounded-2xl p-4 ring-1", tone)}>
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Next step
        </h3>
        {lead.nextAction && lead.nextActionOn && !editing ? (
          <span
            className={cn(
              "ml-auto rounded-md px-2 py-0.5 text-[11px] font-semibold",
              state === "overdue"
                ? "bg-status-overdue text-status-overdue-fg"
                : state === "today"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-card text-muted-foreground ring-1 ring-foreground/8",
            )}
          >
            {dueLabel(lead.nextActionOn)}
          </span>
        ) : null}
      </div>

      {lead.nextAction && !editing ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium">{lead.nextAction}</p>
          {canWrite ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => save({ text: "", on: null, done: true }, "Marked done")}
              >
                <Check />
                Done
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Edit next step"
                disabled={pending}
                onClick={() => setEditing(true)}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Clear next step"
                disabled={pending}
                onClick={() => save({ text: "", on: null }, "Next step cleared")}
              >
                <X />
              </Button>
            </div>
          ) : null}
        </div>
      ) : canWrite ? (
        <div className="mt-3 grid gap-3">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (text.trim() && !pending) save({ text, on: day }, "Next step set");
            }}
            placeholder="What happens next? e.g. Follow-up call"
            maxLength={200}
            aria-label="Next step"
            className="bg-card"
          />
          <DayPicker value={day} onChange={setDay} />
          <div className="flex items-center justify-end gap-2">
            {lead.nextAction ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setText(lead.nextAction ?? "");
                  setDay(lead.nextActionOn ?? addDays(1));
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={pending || !text.trim()}
              onClick={() => save({ text, on: day }, "Next step set")}
            >
              {pending ? "Saving…" : "Set next step"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
