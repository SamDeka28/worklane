"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { SoftDocField } from "@/components/editor/soft-doc-field";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Composer, ComposerBar } from "@/components/studio/composer";
import { composerControlClassName } from "@/components/studio/chrome";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ProjectDocsAttachFields,
  uploadProjectAttachments,
  type AttachableDocument,
} from "@/modules/delivery/components/project-docs";
import {
  billMilestoneAction,
  createMilestoneAction,
  createProjectAction,
  createTaskAction,
  createWorkLogAction,
  postContractedChargeAction,
  updateProjectAction,
  updateTaskStatusAction,
} from "@/modules/delivery/actions";
import {
  allowsContractedProjectCharge,
  allowsMilestoneBilling,
  workLogPostsCharge,
} from "@/modules/delivery/ledger";
import type {
  BillingMode,
  MilestoneRecord,
  ProjectRecord,
  TaskRecord,
  TaskStatus,
} from "@/modules/delivery/types";
import {
  formatMajorInput,
  formatMoney,
  fromMinor,
  netFromGross,
  parseMajorToMinor,
  type IsoCurrency,
} from "@/shared/money";

type ClientOption = { id: string; name: string; currency: string };

export function CreateProjectDialog({
  orgSlug,
  clients,
  defaultClientId,
  defaultOpen = false,
  hideTrigger = false,
  returnHref,
  open: openProp,
  onOpenChange,
  attachableDocuments = [],
}: {
  orgSlug: string;
  clients: ClientOption[];
  defaultClientId?: string;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  returnHref?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  attachableDocuments?: AttachableDocument[];
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const [pending, start] = useTransition();
  const selected = defaultClientId ?? clients[0]?.id ?? "";

  useEffect(() => {
    if (!controlled) setUncontrolledOpen(defaultOpen);
  }, [defaultOpen, controlled]);

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  }

  function close() {
    setOpen(false);
    if (defaultOpen && !controlled) {
      router.replace(returnHref ?? `/${orgSlug}/projects`);
    }
  }

  return (
    <ActionSheet
      title="New project"
      description="Hangs off one client. Attach proposals, SOWs, or PDFs if you have them."
      triggerLabel="New project"
      triggerDisabled={clients.length === 0}
      hideTrigger={hideTrigger}
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else setOpen(true);
      }}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await createProjectAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            try {
              await uploadProjectAttachments(orgSlug, result.id!, formData);
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Project created, but a file failed to upload",
              );
            }
            toast.success("Project created");
            close();
            router.push(`/${orgSlug}/projects/${result.id}`);
            router.refresh();
          });
        }}
      >
        <Field label="Client" htmlFor="client_id">
          <NativeSelect id="client_id" name="client_id" required defaultValue={selected}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" required placeholder="RNPL, Vince kickoff…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" htmlFor="status">
            <NativeSelect id="status" name="status" defaultValue="active">
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </NativeSelect>
          </Field>
          <Field label="Billing" htmlFor="billing_mode">
            <NativeSelect id="billing_mode" name="billing_mode" defaultValue="hourly">
              <option value="hourly">Hourly (logs post charges)</option>
              <option value="single_charge">Single contracted charge</option>
              <option value="milestones">Milestones</option>
              <option value="manual">Manual</option>
              <option value="none">None (track only)</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label="Platform fee" htmlFor="default_fee_bps">
          <NativeSelect id="default_fee_bps" name="default_fee_bps" defaultValue="500">
            <option value="0">None (0%)</option>
            <option value="400">4%</option>
            <option value="500">5% Upwork</option>
            <option value="1300">13%</option>
          </NativeSelect>
        </Field>
        <Field label="Partner earn on" htmlFor="earn_on" hint="When partners earn their share of net">
          <NativeSelect id="earn_on" name="earn_on" defaultValue="charge">
            <option value="charge">When charged</option>
            <option value="receipt">When collected</option>
          </NativeSelect>
        </Field>
        <Field label="Contracted amount" htmlFor="contracted_amount">
          <Input id="contracted_amount" name="contracted_amount" inputMode="decimal" placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts" htmlFor="starts_on">
            <Input id="starts_on" name="starts_on" type="date" />
          </Field>
          <Field label="Due" htmlFor="due_on">
            <Input id="due_on" name="due_on" type="date" />
          </Field>
        </div>
        <SoftDocField
          label="Scope"
          name="scope"
          orgSlug={orgSlug}
          placeholder="Internal scope notes"
        />
        <ProjectDocsAttachFields documents={attachableDocuments} />
        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full"
          disabled={pending || clients.length === 0}
        >
          {pending ? "Saving…" : "Create project"}
        </Button>
      </form>
    </ActionSheet>
  );
}

export function EditProjectForm({
  orgSlug,
  project,
}: {
  orgSlug: string;
  project: ProjectRecord;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-4"
      action={(formData) => {
        start(async () => {
          const result = await updateProjectAction(orgSlug, project.id, formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Saved");
          router.refresh();
        });
      }}
    >
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={project.name} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status" htmlFor="status">
          <NativeSelect id="status" name="status" defaultValue={project.status}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </NativeSelect>
        </Field>
        <Field label="Billing" htmlFor="billing_mode">
          <NativeSelect id="billing_mode" name="billing_mode" defaultValue={project.billingMode}>
            <option value="hourly">Hourly (logs post charges)</option>
            <option value="single_charge">Single contracted charge</option>
            <option value="milestones">Milestones</option>
            <option value="manual">Manual</option>
            <option value="none">None (track only)</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Platform fee" htmlFor="default_fee_bps">
        <NativeSelect id="default_fee_bps" name="default_fee_bps" defaultValue={String(project.defaultFeeBps)}>
          <option value="0">None (0%)</option>
          <option value="400">4%</option>
          <option value="500">5% Upwork</option>
          <option value="1300">13%</option>
        </NativeSelect>
      </Field>
      <Field label="Partner earn on" htmlFor="earn_on">
        <NativeSelect id="earn_on" name="earn_on" defaultValue={project.earnOn}>
          <option value="charge">When charged</option>
          <option value="receipt">When collected</option>
        </NativeSelect>
      </Field>
      <Field label="Contracted amount" htmlFor="contracted_amount">
        <Input
          id="contracted_amount"
          name="contracted_amount"
          inputMode="decimal"
          defaultValue={
            project.contractedAmountMinor != null
              ? String(fromMinor(project.contractedAmountMinor, project.currency))
              : ""
          }
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts" htmlFor="starts_on">
          <Input id="starts_on" name="starts_on" type="date" defaultValue={project.startsOn ?? ""} />
        </Field>
        <Field label="Due" htmlFor="due_on">
          <Input id="due_on" name="due_on" type="date" defaultValue={project.dueOn ?? ""} />
        </Field>
      </div>
      <SoftDocField
        label="Scope"
        name="scope"
        orgSlug={orgSlug}
        initialDoc={project.scopeDoc}
        initialPlain={project.scope}
        placeholder="Internal scope notes"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function ProjectSettingsSheet({
  orgSlug,
  project,
  defaultOpen = false,
  hideTrigger = false,
  returnHref,
}: {
  orgSlug: string;
  project: ProjectRecord;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  returnHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  function close() {
    setOpen(false);
    if (defaultOpen) {
      router.replace(returnHref ?? `/${orgSlug}/projects/${project.id}`);
    }
  }

  return (
    <ActionSheet
      title="Project settings"
      triggerLabel="Settings"
      triggerVariant="ghost"
      hideTrigger={hideTrigger}
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else setOpen(true);
      }}
    >
      <EditProjectForm orgSlug={orgSlug} project={project} />
    </ActionSheet>
  );
}

export function WorkLogComposer({
  orgSlug,
  projectId,
  billingMode,
  milestones,
  currency = "USD",
  defaultFeeBps = 500,
  defaultHourlyRateMinor = null,
}: {
  orgSlug: string;
  projectId: string;
  billingMode: BillingMode;
  milestones: MilestoneRecord[];
  currency?: IsoCurrency;
  defaultFeeBps?: number;
  defaultHourlyRateMinor?: bigint | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState(
    defaultHourlyRateMinor != null
      ? formatMajorInput(defaultHourlyRateMinor, currency)
      : "",
  );
  const [fixed, setFixed] = useState("");
  const posts = workLogPostsCharge(billingMode);

  let previewMinor: bigint | null = null;
  if (posts) {
    try {
      if (fixed.trim()) {
        previewMinor = parseMajorToMinor(fixed, currency);
      } else if (hours.trim() && rate.trim()) {
        const h = Number(hours);
        const rateMinor = parseMajorToMinor(rate, currency);
        if (Number.isFinite(h) && h > 0) {
          previewMinor = BigInt(Math.round(h * 1000)) * rateMinor / BigInt(1000);
        }
      }
    } catch {
      previewMinor = null;
    }
  }
  const netPreview =
    previewMinor != null ? netFromGross(previewMinor, defaultFeeBps) : null;

  return (
    <Composer>
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-semibold tracking-tight">Log work</p>
          <p className="text-xs text-muted-foreground">
            {posts
              ? netPreview != null
                ? `Posts ~${formatMoney({ amountMinor: netPreview, currency })} net after fee`
                : "Posts a charge when hours or a fixed amount are set."
              : "Track time without billing."}
          </p>
        </div>
      </div>
      <ComposerBar prominent>
        <form
          ref={formRef}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
          action={(formData) => {
            start(async () => {
              const result = await createWorkLogAction(orgSlug, projectId, formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success(result.charged ? "Logged and charged" : "Work logged");
              formRef.current?.reset();
              setHours("");
              setRate(
                defaultHourlyRateMinor != null
                  ? formatMajorInput(defaultHourlyRateMinor, currency)
                  : "",
              );
              setFixed("");
              router.refresh();
            });
          }}
        >
          <Input
            name="worked_on"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={cn(composerControlClassName, "h-10 w-40")}
            aria-label="Date"
          />
          <Input
            name="hours"
            inputMode="decimal"
            placeholder="Hours"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className={cn(composerControlClassName, "h-10 w-24")}
          />
          <Input
            name="hourly_rate"
            inputMode="decimal"
            placeholder="Rate"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            className={cn(composerControlClassName, "h-10 w-24")}
          />
          <Input
            name="fixed_amount"
            inputMode="decimal"
            placeholder="Fixed"
            value={fixed}
            onChange={(event) => setFixed(event.target.value)}
            className={cn(composerControlClassName, "h-10 w-24")}
          />
          {milestones.length > 0 ? (
            <NativeSelect
              name="milestone_id"
              defaultValue=""
              className={cn(composerControlClassName, "h-10 w-40")}
            >
              <option value="">Milestone</option>
              {milestones.map((item, index) => (
                <option key={item.id} value={item.id}>
                  {`M${index + 1} · ${item.name}`}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <Input
            name="description"
            placeholder="What shipped"
            className={cn(composerControlClassName, "h-10 min-w-44 flex-1")}
          />
          <Input
            name="external_url"
            placeholder="Trello URL"
            className={cn(composerControlClassName, "h-10 min-w-40 flex-1")}
          />
          <Button type="submit" disabled={pending} className="m-1 h-10 px-4">
            {pending ? "Saving…" : posts ? "Log and charge" : "Log work"}
          </Button>
        </form>
      </ComposerBar>
    </Composer>
  );
}

/** @deprecated Use WorkLogComposer. Kept for any remaining imports. */
export function WorkLogForm(props: {
  orgSlug: string;
  projectId: string;
  billingMode: BillingMode;
  milestones: MilestoneRecord[];
  defaultOpen?: boolean;
}) {
  return <WorkLogComposer {...props} />;
}

export function MilestoneForm({
  orgSlug,
  projectId,
  billingMode,
  defaultOpen = false,
  returnHref,
  triggerLabel = "Add milestone",
  triggerSize = "default",
  triggerVariant = "default",
  hideTrigger = false,
  className,
}: {
  orgSlug: string;
  projectId: string;
  billingMode: BillingMode;
  defaultOpen?: boolean;
  returnHref?: string;
  triggerLabel?: string;
  triggerSize?: "default" | "sm" | "lg";
  triggerVariant?: "default" | "outline";
  hideTrigger?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const formId = "new-milestone-form";
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [pending, start] = useTransition();

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  function close() {
    setOpen(false);
    if (defaultOpen && returnHref) {
      router.replace(returnHref);
    }
  }

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          size={triggerSize}
          variant={triggerVariant}
          className={className}
          onClick={() => setOpen(true)}
        >
          {triggerLabel}
        </Button>
      )}
      <ActionSheet
        title="New milestone"
        description="Name the slice of work, optional price and due date. Add deliverables after create."
        hideTrigger
        side="right"
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
          else setOpen(true);
        }}
        footer={
          <Button type="submit" form={formId} size="lg" className="w-full" disabled={pending}>
            {pending ? "Adding…" : "Add milestone"}
          </Button>
        }
      >
        <form
          id={formId}
          ref={formRef}
          className="grid gap-4"
          action={(formData) => {
            start(async () => {
              const result = await createMilestoneAction(orgSlug, projectId, formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Milestone added");
              formRef.current?.reset();
              close();
              router.refresh();
            });
          }}
        >
          <Field label="Name" htmlFor="milestone_name">
            <Input
              id="milestone_name"
              name="name"
              required
              placeholder="Kickoff, design, launch…"
            />
          </Field>
          <Field label="Delivery status" htmlFor="milestone_status" hint="Separate from billing">
            <NativeSelect id="milestone_status" name="status" defaultValue="planned">
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Done</option>
              <option value="cancelled">Cancelled</option>
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount" htmlFor="milestone_amount">
              <Input
                id="milestone_amount"
                name="amount"
                inputMode="decimal"
                placeholder="Optional"
              />
            </Field>
            <Field label="Due" htmlFor="milestone_due">
              <Input id="milestone_due" name="due_on" type="date" />
            </Field>
          </div>
          <SoftDocField
            label="Description"
            name="description"
            orgSlug={orgSlug}
            entityType="project"
            entityId={projectId}
            placeholder="Context for this milestone…"
            hint="Add checklist deliverables after create: each can become a task"
            minHeightClassName="min-h-28"
          />
          {!allowsMilestoneBilling(billingMode) ? (
            <p className="text-xs text-muted-foreground">
              Charge posts on milestone or manual projects. Status stays delivery-only.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Amount is for billing later. Status tracks delivery progress.
            </p>
          )}
        </form>
      </ActionSheet>
    </>
  );
}

export function BillMilestoneButton({
  orgSlug,
  milestoneId,
  projectId,
  billingMode,
  disabled,
}: {
  orgSlug: string;
  milestoneId: string;
  projectId?: string;
  billingMode: BillingMode;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const allowed = allowsMilestoneBilling(billingMode);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending || disabled || !allowed}
      onClick={() => {
        start(async () => {
          const result = await billMilestoneAction(orgSlug, milestoneId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Charge posted: collect when paid");
          if (result.chargeId && (projectId || result.projectId)) {
            router.push(
              `/${orgSlug}/projects/${projectId ?? result.projectId}?tab=charges&collect=1&charge=${result.chargeId}`,
            );
          }
          router.refresh();
        });
      }}
    >
      {pending ? "Charging…" : "Charge"}
    </Button>
  );
}

export function PostContractedChargeButton({
  orgSlug,
  projectId,
  billingMode,
}: {
  orgSlug: string;
  projectId: string;
  billingMode: BillingMode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!allowsContractedProjectCharge(billingMode)) return null;

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = await postContractedChargeAction(orgSlug, projectId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Contracted charge posted");
          router.refresh();
        });
      }}
    >
      {pending ? "Posting…" : "Post contracted charge"}
    </Button>
  );
}

export function TaskForm({
  orgSlug,
  projectId,
  milestones,
  assignees = [],
}: {
  orgSlug: string;
  projectId: string;
  milestones: MilestoneRecord[];
  assignees?: { userId: string; label: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      className="flex flex-wrap items-end gap-2 rounded-2xl bg-muted/80 p-3"
      action={(formData) => {
        start(async () => {
          const result = await createTaskAction(orgSlug, projectId, formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Task added");
          formRef.current?.reset();
          router.refresh();
        });
      }}
    >
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Title</span>
        <Input name="title" required placeholder="Ship homepage…" />
      </label>
      <label className="flex w-28 flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Priority</span>
        <NativeSelect name="priority" defaultValue="medium">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </NativeSelect>
      </label>
      <label className="flex w-36 flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Due</span>
        <Input name="due_on" type="date" />
      </label>
      {milestones.length > 0 ? (
        <label className="flex w-40 flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Milestone</span>
          <NativeSelect name="milestone_id" defaultValue="">
            <option value="">None</option>
            {milestones.map((item, index) => (
              <option key={item.id} value={item.id}>
                {`M${index + 1} · ${item.name}`}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : null}
      {assignees.length > 0 ? (
        <label className="flex w-40 flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Assignee</span>
          <NativeSelect name="assignee_user_id" defaultValue="">
            <option value="">Unassigned</option>
            {assignees.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.label}
              </option>
            ))}
          </NativeSelect>
        </label>
      ) : null}
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}

export function ProjectOverflow({
  orgSlug,
  projectId,
  clientId,
  billingMode,
  settingsHref,
}: {
  orgSlug: string;
  projectId: string;
  clientId: string;
  billingMode: BillingMode;
  settingsHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const canContracted = allowsContractedProjectCharge(billingMode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="More" />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => router.push(`/${orgSlug}/finance?client=${clientId}`)}
        >
          Collect
        </DropdownMenuItem>
        {canContracted ? (
          <DropdownMenuItem
            disabled={pending}
            onClick={() => {
              start(async () => {
                const result = await postContractedChargeAction(orgSlug, projectId);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Contracted charge posted");
                router.refresh();
              });
            }}
          >
            Post contracted charge
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => router.push(settingsHref)}>
          Project settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TaskStatusButtons({
  orgSlug,
  task,
}: {
  orgSlug: string;
  task: TaskRecord;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: { label: string; status: TaskStatus }[] =
    task.status === "todo"
      ? [{ label: "Start", status: "doing" }]
      : task.status === "doing"
        ? [
            { label: "Back", status: "todo" },
            { label: "Done", status: "done" },
          ]
        : [{ label: "Reopen", status: "todo" }];

  return (
    <span className="inline-flex gap-1">
      {next.map((item) => (
        <Button
          key={item.status}
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const result = await updateTaskStatusAction(orgSlug, task.id, item.status);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {item.label}
        </Button>
      ))}
    </span>
  );
}
