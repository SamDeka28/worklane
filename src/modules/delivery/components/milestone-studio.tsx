"use client";

import { CheckSquare, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SoftDocField } from "@/components/editor/soft-doc-field";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { StatusChip } from "@/components/studio/status-chip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  addMilestoneItemAction,
  billMilestoneAction,
  createTaskFromMilestoneAction,
  createTaskFromMilestoneItemAction,
  deleteMilestoneItemAction,
  removeMilestoneBoardTaskAction,
  unlinkMilestoneItemTaskAction,
  updateMilestoneAction,
  updateMilestoneStatusAction,
} from "@/modules/delivery/actions";
import { allowsMilestoneBilling } from "@/modules/delivery/ledger";
import {
  MILESTONE_STATUS_LABEL,
  milestoneBillingLabel,
  milestoneBillingLife,
  type MilestoneBillingLife,
} from "@/modules/delivery/milestone-life";
import type {
  BillingMode,
  MilestoneItemRecord,
  MilestoneRecord,
  MilestoneStatus,
} from "@/modules/delivery/types";
import { formatDay } from "@/modules/finance/presentation";
import { moneyLabel, type ChargeView } from "@/modules/finance/ledger";
import { formatMajorInput } from "@/shared/money";

const STATUS_OPTIONS: MilestoneStatus[] = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
];

function billingTone(life: MilestoneBillingLife): "due" | "overdue" | "paid" | "planning" | "active" {
  if (life === "paid") return "paid";
  if (life === "overdue") return "overdue";
  if (life === "due") return "due";
  if (life === "void") return "planning";
  return "active";
}

function milestoneCode(index: number) {
  return `M${index + 1}`;
}

function MilestoneItemsEditor({
  orgSlug,
  milestoneId,
  items,
  workHref,
  canWrite,
}: {
  orgSlug: string;
  milestoneId: string;
  items: MilestoneItemRecord[];
  workHref?: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Deliverables</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Concrete items that ship in this milestone. Each can become a board task.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          No deliverables yet. Add the first slice of work below.
        </p>
      ) : (
        <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl ring-1 ring-border/40">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 bg-card px-3 py-2">
              <span className="text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
              <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
              {canWrite ? (
                <div className="flex shrink-0 items-center gap-1">
                  {item.taskId ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={workHref ?? "#work"} />}
                      >
                        On board
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          start(async () => {
                            const result = await unlinkMilestoneItemTaskAction(orgSlug, item.id);
                            if (result.error) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success("Removed from board");
                            router.refresh();
                          });
                        }}
                      >
                        Unlink
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={pending}
                      onClick={() => {
                        start(async () => {
                          const result = await createTaskFromMilestoneItemAction(orgSlug, item.id);
                          if (result.error) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("Deliverable added to the board");
                          router.refresh();
                        });
                      }}
                    >
                      <CheckSquare className="size-3.5" />
                      Task
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="px-2 text-muted-foreground"
                    disabled={pending}
                    aria-label={`Remove ${item.title}`}
                    onClick={() => {
                      start(async () => {
                        const result = await deleteMilestoneItemAction(orgSlug, item.id);
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : item.taskId ? (
                <StatusChip tone="planning">On board</StatusChip>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Content hierarchy map"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (!title.trim() || pending) return;
              start(async () => {
                const result = await addMilestoneItemAction(orgSlug, milestoneId, title);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                setTitle("");
                router.refresh();
              });
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1"
            disabled={pending || !title.trim()}
            onClick={() => {
              start(async () => {
                const result = await addMilestoneItemAction(orgSlug, milestoneId, title);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                setTitle("");
                router.refresh();
              });
            }}
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EditMilestoneDialog({
  orgSlug,
  currency,
  milestone,
  items,
  code,
  billingMode,
  billed,
  workHref,
  open,
  onOpenChange,
  showTrigger = true,
}: {
  orgSlug: string;
  currency: "USD" | "INR";
  milestone: MilestoneRecord;
  items: MilestoneItemRecord[];
  code: string;
  billingMode: BillingMode;
  billed: boolean;
  workHref?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTrigger?: boolean;
}) {
  const router = useRouter();
  const formId = `edit-milestone-${milestone.id}`;
  const [pending, start] = useTransition();
  const description = milestone.description ?? milestone.deliverables;
  const descriptionDoc = milestone.descriptionDoc ?? milestone.deliverablesDoc;

  return (
    <>
      {showTrigger ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="px-2"
          aria-label={`Edit ${code}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenChange(true);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : null}
      <ActionSheet
        title={`Edit ${code}`}
        description={
          billed
            ? "Description is narrative. Deliverables become board tasks. Amount is locked after charging."
            : "Description is narrative. Deliverables are checklist items you can turn into tasks."
        }
        hideTrigger
        side="right"
        open={open}
        onOpenChange={onOpenChange}
        footer={
          <Button type="submit" form={formId} size="lg" className="w-full" disabled={pending}>
            {pending ? "Saving…" : `Save ${code}`}
          </Button>
        }
      >
        <div className="space-y-6">
          <form
            id={formId}
            className="grid gap-4"
            action={(formData) => {
              start(async () => {
                const result = await updateMilestoneAction(orgSlug, milestone.id, formData);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success(`${code} updated`);
                onOpenChange(false);
                router.refresh();
              });
            }}
          >
            <Field label="Name" htmlFor={`edit_name_${milestone.id}`}>
              <Input
                id={`edit_name_${milestone.id}`}
                name="name"
                required
                defaultValue={milestone.name}
              />
            </Field>
            <Field label="Delivery status" htmlFor={`edit_status_${milestone.id}`}>
              <NativeSelect
                id={`edit_status_${milestone.id}`}
                name="status"
                defaultValue={milestone.status}
              >
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Done</option>
                <option value="cancelled">Cancelled</option>
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount" htmlFor={`edit_amount_${milestone.id}`}>
                <Input
                  id={`edit_amount_${milestone.id}`}
                  name="amount"
                  inputMode="decimal"
                  disabled={billed}
                  defaultValue={
                    milestone.amountMinor != null
                      ? formatMajorInput(milestone.amountMinor, currency)
                      : ""
                  }
                  placeholder="Optional"
                />
              </Field>
              <Field label="Due" htmlFor={`edit_due_${milestone.id}`}>
                <Input
                  id={`edit_due_${milestone.id}`}
                  name="due_on"
                  type="date"
                  defaultValue={milestone.dueOn ?? ""}
                />
              </Field>
            </div>
            <SoftDocField
              key={`description-${milestone.id}-${open}`}
              label="Description"
              name="description"
              orgSlug={orgSlug}
              entityType="milestone"
              entityId={milestone.id}
              initialDoc={descriptionDoc}
              initialPlain={description}
              placeholder="Context for this milestone…"
              hint="Narrative only — checklist items live under Deliverables"
              minHeightClassName="min-h-24"
            />
            {!allowsMilestoneBilling(billingMode) ? (
              <p className="text-xs text-muted-foreground">
                Charge posts on milestone or manual projects. Status stays delivery-only.
              </p>
            ) : null}
          </form>

          <MilestoneItemsEditor
            orgSlug={orgSlug}
            milestoneId={milestone.id}
            items={items}
            workHref={workHref}
            canWrite
          />
        </div>
      </ActionSheet>
    </>
  );
}

function MilestoneRow({
  orgSlug,
  projectId,
  billingMode,
  currency,
  item,
  items,
  index,
  charge,
  linkedTaskId,
  canWrite,
  canBill,
  collectBaseHref,
  workHref,
  highlighted,
  pending,
  start,
}: {
  orgSlug: string;
  projectId: string;
  billingMode: BillingMode;
  currency: "USD" | "INR";
  item: MilestoneRecord;
  items: MilestoneItemRecord[];
  index: number;
  charge: ChargeView | null;
  linkedTaskId?: string;
  canWrite: boolean;
  canBill: boolean;
  collectBaseHref: string;
  workHref?: string;
  highlighted: boolean;
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
}) {
  const router = useRouter();
  const code = milestoneCode(index);
  const billing = milestoneBillingLife(item, charge);
  const due = charge?.outstandingMinor ?? BigInt(0);
  const description = item.description ?? item.deliverables;
  const [editOpen, setEditOpen] = useState(false);
  const taskedCount = items.filter((row) => row.taskId).length;

  function openEditor() {
    if (!canWrite) return;
    setEditOpen(true);
  }

  return (
    <li id={`milestone-${item.id}`} className={cn(highlighted && "bg-sky-50/80")}>
      <div className="flex items-start gap-2 px-3 py-2.5 sm:items-center sm:gap-3 sm:px-4">
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 rounded-xl text-left transition-colors",
            canWrite &&
              "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          )}
          onClick={openEditor}
          disabled={!canWrite}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex h-5 min-w-7 items-center justify-center rounded-md bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {code}
            </span>
            <p className="min-w-0 truncate text-sm font-semibold tracking-tight">{item.name}</p>
            <StatusChip tone={billingTone(billing)}>{milestoneBillingLabel(billing)}</StatusChip>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{MILESTONE_STATUS_LABEL[item.status]}</span>
            <span aria-hidden>·</span>
            <span>{item.dueOn ? `Due ${formatDay(item.dueOn)}` : "No due date"}</span>
            {items.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {items.length} deliverable{items.length === 1 ? "" : "s"}
                  {taskedCount > 0 ? ` · ${taskedCount} on board` : ""}
                </span>
              </>
            ) : null}
            {linkedTaskId ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-violet-700">Milestone card</span>
              </>
            ) : null}
            {(billing === "due" || billing === "overdue") && charge ? (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{moneyLabel(due, currency)} still due</span>
              </>
            ) : null}
            {description ? (
              <>
                <span aria-hidden>·</span>
                <span className="max-w-[18rem] truncate">{description}</span>
              </>
            ) : null}
          </p>
        </button>

        <div
          className="flex shrink-0 flex-col items-end gap-1.5"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={cn(
              "text-sm font-semibold tabular-nums",
              canWrite && "rounded-lg px-1.5 py-0.5 hover:bg-muted/50",
            )}
            onClick={openEditor}
            disabled={!canWrite}
          >
            {item.amountMinor != null ? moneyLabel(item.amountMinor, currency) : "—"}
          </button>
          {canWrite ? (
            <div className="flex flex-wrap items-center justify-end gap-1">
              <NativeSelect
                className="h-8 w-[6.5rem] text-xs"
                value={item.status}
                disabled={pending}
                aria-label={`${code} status`}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const status = event.target.value as MilestoneStatus;
                  start(async () => {
                    const result = await updateMilestoneStatusAction(orgSlug, item.id, status);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {MILESTONE_STATUS_LABEL[status]}
                  </option>
                ))}
              </NativeSelect>

              <EditMilestoneDialog
                orgSlug={orgSlug}
                currency={currency}
                milestone={item}
                items={items}
                code={code}
                billingMode={billingMode}
                billed={Boolean(item.chargeId)}
                workHref={workHref}
                open={editOpen}
                onOpenChange={setEditOpen}
              />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="px-2"
                      aria-label={`${code} more actions`}
                      onClick={(event) => event.stopPropagation()}
                    />
                  }
                >
                  <MoreHorizontal className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  {linkedTaskId ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => router.push(workHref ?? "#work")}
                      >
                        Open on board
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={pending}
                        onClick={() => {
                          start(async () => {
                            const result = await removeMilestoneBoardTaskAction(orgSlug, item.id);
                            if (result.error) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success(`${code} removed from the board`);
                            router.refresh();
                          });
                        }}
                      >
                        Remove from board
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      disabled={pending || item.status === "cancelled"}
                      onClick={() => {
                        start(async () => {
                          const result = await createTaskFromMilestoneAction(orgSlug, item.id);
                          if (result.error) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success(`${code} added to the board`);
                          router.refresh();
                        });
                      }}
                    >
                      Add to board
                    </DropdownMenuItem>
                  )}

                  {billing === "unbilled" && canBill ? (
                    <DropdownMenuItem
                      disabled={pending || item.amountMinor == null || item.status === "cancelled"}
                      onClick={() => {
                        start(async () => {
                          const result = await billMilestoneAction(orgSlug, item.id);
                          if (result.error) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("Charge posted — collect when paid");
                          if (result.chargeId) {
                            router.push(
                              `/${orgSlug}/projects/${projectId}?tab=charges&collect=1&charge=${result.chargeId}`,
                            );
                          }
                          router.refresh();
                        });
                      }}
                    >
                      Charge
                    </DropdownMenuItem>
                  ) : null}

                  {(billing === "due" || billing === "overdue") && charge ? (
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(
                          `${collectBaseHref}${collectBaseHref.includes("?") ? "&" : "?"}charge=${charge.id}`,
                        )
                      }
                    >
                      Collect
                    </DropdownMenuItem>
                  ) : null}

                  {billing === "paid" && charge ? (
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(
                          `/${orgSlug}/projects/${projectId}?tab=charges&charge=${charge.id}`,
                        )
                      }
                    >
                      View charge
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function MilestoneStudioList({
  orgSlug,
  projectId,
  billingMode,
  currency,
  milestones,
  itemsByMilestone,
  chargeByMilestone,
  taskByMilestone,
  canWrite,
  collectBaseHref,
  workHref,
  highlightMilestoneId,
}: {
  orgSlug: string;
  projectId: string;
  billingMode: BillingMode;
  currency: "USD" | "INR";
  milestones: MilestoneRecord[];
  itemsByMilestone: Record<string, MilestoneItemRecord[]>;
  chargeByMilestone: Map<string, ChargeView>;
  taskByMilestone: Map<string, string>;
  canWrite: boolean;
  collectBaseHref: string;
  workHref?: string;
  highlightMilestoneId?: string;
}) {
  const [pending, start] = useTransition();
  const canBill = allowsMilestoneBilling(billingMode);

  return (
    <ol className="divide-y divide-border/40 overflow-hidden rounded-4xl bg-card ring-1 ring-border/30">
      {milestones.map((item, index) => (
        <MilestoneRow
          key={`${item.id}:${item.name}:${item.status}:${item.dueOn ?? ""}:${item.amountMinor?.toString() ?? ""}:${item.description ?? item.deliverables ?? ""}`}
          orgSlug={orgSlug}
          projectId={projectId}
          billingMode={billingMode}
          currency={currency}
          item={item}
          items={itemsByMilestone[item.id] ?? []}
          index={index}
          charge={chargeByMilestone.get(item.id) ?? null}
          linkedTaskId={taskByMilestone.get(item.id)}
          canWrite={canWrite}
          canBill={canBill}
          collectBaseHref={collectBaseHref}
          workHref={workHref}
          highlighted={highlightMilestoneId === item.id}
          pending={pending}
          start={start}
        />
      ))}
    </ol>
  );
}
