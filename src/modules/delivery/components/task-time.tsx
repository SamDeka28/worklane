"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useActionProgress as useTransition } from "@/components/studio/use-action-progress";
import { Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createWorkLogAction,
  discardTaskClockAction,
  stopTaskClockAction,
  type TaskClockStop,
} from "@/modules/delivery/actions";
import type { TaskRecord } from "@/modules/delivery/types";
import { formatMajorInput, formatMoney, type IsoCurrency } from "@/shared/money";

/** `2026-09-28T14:05` in the viewer's time zone, for datetime-local inputs. */
export function toLocalInput(iso: string | Date) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Hours between two instants, to three decimals, or "" when they don't make a span. */
export function hoursBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return "";
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  return String(Math.max(0.001, Math.round(ms / 3_600) / 1000));
}

function parseLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatSpan(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const subscribeNever = () => () => {};

/** Start–end times of a work log in the viewer's time zone (blank during server render). */
export function LogTimeRange({ startedAt, endedAt }: { startedAt: string; endedAt: string }) {
  const onClient = useSyncExternalStore(subscribeNever, () => true, () => false);
  if (!onClient) return null;
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (
    <span className="ml-2 font-normal text-muted-foreground tabular-nums">
      {time(startedAt)} – {time(endedAt)}
    </span>
  );
}

/** Confirms a stopped clock as a work log: times, hours and rate stay editable. */
export function LogTimeDialog({
  orgSlug,
  clock,
  onClose,
  currency,
  defaultRateMinor,
}: {
  orgSlug: string;
  clock: TaskClockStop | null;
  onClose: () => void;
  currency?: IsoCurrency;
  defaultRateMinor?: bigint | null;
}) {
  return (
    <Dialog open={Boolean(clock)} onOpenChange={(open) => !open && onClose()}>
      {clock ? (
        <LogTimeForm
          key={`${clock.taskId}-${clock.stoppedAt}`}
          orgSlug={orgSlug}
          clock={clock}
          onClose={onClose}
          currency={currency}
          defaultRateMinor={defaultRateMinor}
        />
      ) : null}
    </Dialog>
  );
}

function LogTimeForm({
  orgSlug,
  clock,
  onClose,
  currency,
  defaultRateMinor,
}: {
  orgSlug: string;
  clock: TaskClockStop;
  onClose: () => void;
  currency?: IsoCurrency;
  defaultRateMinor?: bigint | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [startValue, setStartValue] = useState(toLocalInput(clock.startedAt));
  const [endValue, setEndValue] = useState(toLocalInput(clock.stoppedAt));
  const [hours, setHours] = useState(hoursBetween(new Date(clock.startedAt), new Date(clock.stoppedAt)));
  const [rate, setRate] = useState(
    defaultRateMinor != null && currency ? formatMajorInput(defaultRateMinor, currency) : "",
  );
  const [note, setNote] = useState(clock.title);

  function syncHours(nextStart: string, nextEnd: string) {
    setHours(hoursBetween(parseLocal(nextStart), parseLocal(nextEnd)));
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Log time</DialogTitle>
        <DialogDescription>
          {clock.title}. Adjust the start and end if the clock ran while you weren&apos;t working.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const started = parseLocal(startValue);
          const ended = parseLocal(endValue);
          if (!started || !ended || ended <= started) {
            toast.error("End time must be after the start time");
            return;
          }
          const formData = new FormData();
          formData.set("task_id", clock.taskId);
          formData.set("worked_on", startValue.slice(0, 10));
          formData.set("started_at", started.toISOString());
          formData.set("ended_at", ended.toISOString());
          formData.set("hours", hours);
          if (rate.trim()) formData.set("hourly_rate", rate);
          formData.set("description", note);
          start(async () => {
            const result = await createWorkLogAction(orgSlug, clock.projectId, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success(result.charged ? "Logged and charged" : "Time logged");
            onClose();
            router.refresh();
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Started" htmlFor="log_started">
            <Input
              id="log_started"
              type="datetime-local"
              value={startValue}
              onChange={(event) => {
                setStartValue(event.target.value);
                syncHours(event.target.value, endValue);
              }}
            />
          </Field>
          <Field label="Ended" htmlFor="log_ended">
            <Input
              id="log_ended"
              type="datetime-local"
              value={endValue}
              onChange={(event) => {
                setEndValue(event.target.value);
                syncHours(startValue, event.target.value);
              }}
            />
          </Field>
          <Field label="Hours" htmlFor="log_hours" hint="From the times; change it to bill less or more">
            <Input
              id="log_hours"
              type="number"
              min="0.001"
              step="0.001"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
          </Field>
          <Field
            label={currency ? `Rate per hour (${currency})` : "Rate per hour"}
            htmlFor="log_rate"
            hint={rate ? undefined : "Blank uses the project's rate"}
          >
            <Input
              id="log_rate"
              type="number"
              min="0"
              step="0.01"
              placeholder="Project rate"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          </Field>
        </div>
        <Field label="What shipped" htmlFor="log_note">
          <Input id="log_note" value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Later
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Log and charge"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Running clocks and stopped time still to log, on an hourly project's Log view. */
export function TaskClocks({
  orgSlug,
  tasks,
  canWrite,
  currency,
  defaultRateMinor,
}: {
  orgSlug: string;
  tasks: TaskRecord[];
  canWrite: boolean;
  currency: IsoCurrency;
  defaultRateMinor: bigint | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [logging, setLogging] = useState<TaskClockStop | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const clocks = tasks.filter((task) => task.timeStartedAt);
  const anyRunning = clocks.some((task) => !task.timeStoppedAt);

  useEffect(() => {
    if (!anyRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [anyRunning]);

  if (clocks.length === 0) return null;

  return (
    <section className="mb-4 grid gap-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <Timer className="size-3.5" />
        Clocks
      </p>
      <ul className="grid gap-2">
        {clocks.map((task) => {
          const running = !task.timeStoppedAt;
          const startedAt = task.timeStartedAt!;
          const endMs = running ? now : new Date(task.timeStoppedAt!).getTime();
          const span = formatSpan(endMs - new Date(startedAt).getTime());
          return (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3 ring-1 ring-border/30"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  {running ? (
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                  ) : (
                    <Square className="size-3 text-muted-foreground" />
                  )}
                  {task.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums" suppressHydrationWarning>
                  {running
                    ? `Running since ${formatClock(startedAt)} · ${span}`
                    : `${formatClock(startedAt)} – ${formatClock(task.timeStoppedAt!)} · ${span} to log`}
                  {defaultRateMinor != null && !running
                    ? ` · ${formatMoney({ amountMinor: defaultRateMinor, currency })}/hr`
                    : ""}
                </p>
              </div>
              {canWrite ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  {running ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const result = await stopTaskClockAction(orgSlug, task.id);
                          if ("error" in result && result.error) {
                            toast.error(result.error);
                            return;
                          }
                          if ("stopped" in result && result.stopped) setLogging(result.stopped);
                          router.refresh();
                        })
                      }
                    >
                      <Square />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        setLogging({
                          taskId: task.id,
                          projectId: task.projectId,
                          title: task.title,
                          startedAt,
                          stoppedAt: task.timeStoppedAt!,
                        })
                      }
                    >
                      Log time
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await discardTaskClockAction(orgSlug, task.id);
                        if ("error" in result && result.error) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Clock discarded");
                        router.refresh();
                      })
                    }
                  >
                    Discard
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <LogTimeDialog
        orgSlug={orgSlug}
        clock={logging}
        onClose={() => setLogging(null)}
        currency={currency}
        defaultRateMinor={defaultRateMinor}
      />
    </section>
  );
}
