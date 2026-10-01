"use client";

import { FolderPlus, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActionProgress as useTransition } from "@/components/studio/use-action-progress";
import { toast } from "sonner";
import { SoftDocField } from "@/components/editor/soft-doc-field";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Composer, ComposerBar } from "@/components/studio/composer";
import { DangerZone } from "@/components/studio/type-to-confirm";
import { composerControlClassName } from "@/components/studio/chrome";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import type { ClientRecord } from "@/modules/clients/types";
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
import { DeductionField } from "@/modules/delivery/components/deduction-field";
import type { DeductionOption } from "@/modules/delivery/deductions";
import { hoursBetween, toLocalInput } from "@/modules/delivery/components/task-time";
import {
  billMilestoneAction,
  createMilestoneAction,
  createProjectAction,
  createTaskAction,
  createWorkLogAction,
  deleteProjectAction,
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
  deductions = [],
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
  deductions?: DeductionOption[];
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const [pending, start] = useTransition();
  const selected = defaultClientId ?? clients[0]?.id ?? "";
  const [clientId, setClientId] = useState(selected);
  const [billingMode, setBillingMode] = useState<string>("hourly");
  const [retainerBasis, setRetainerBasis] = useState<"fixed" | "hourly">("fixed");
  const clientCurrency = clients.find((client) => client.id === clientId)?.currency ?? "USD";

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
      triggerIcon={<FolderPlus />}
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
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            try {
              await uploadProjectAttachments(orgSlug, result.id, formData);
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
          <NativeSelect
            id="client_id"
            name="client_id"
            required
            defaultValue={selected}
            onChange={(event) => setClientId(event.target.value)}
          >
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
            <NativeSelect
              id="billing_mode"
              name="billing_mode"
              defaultValue="hourly"
              onChange={(event) => setBillingMode(event.target.value)}
            >
              <option value="hourly">Hourly (logs post charges)</option>
              <option value="single_charge">Single contracted charge</option>
              <option value="milestones">Milestones</option>
              <option value="manual">Manual</option>
              <option value="monthly">Monthly retainer</option>
              <option value="none">None (track only)</option>
            </NativeSelect>
          </Field>
        </div>
        {billingMode === "monthly" ? (
          <Field
            label="Retainer"
            htmlFor="retainer_basis"
            hint="Fixed posts the same amount each month. Hourly adds up the hours logged that month."
          >
            <NativeSelect
              id="retainer_basis"
              name="retainer_basis"
              value={retainerBasis}
              onChange={(event) => setRetainerBasis(event.target.value === "hourly" ? "hourly" : "fixed")}
            >
              <option value="fixed">Fixed amount</option>
              <option value="hourly">Hourly</option>
            </NativeSelect>
          </Field>
        ) : null}
        {billingMode === "hourly" || (billingMode === "monthly" && retainerBasis === "hourly") ? (
          <HourlyRateField currency={clientCurrency} />
        ) : null}
        <DeductionField orgSlug={orgSlug} inputName="default_fee_bps" defaultBps={500} deductions={deductions} />
        <Field label="Partner earn on" htmlFor="earn_on" hint="When partners earn their share of net">
          <NativeSelect id="earn_on" name="earn_on" defaultValue="charge">
            <option value="charge">When charged</option>
            <option value="receipt">When collected</option>
          </NativeSelect>
        </Field>
        {billingMode === "monthly" && retainerBasis === "hourly" ? null : (
        <Field
          label={billingMode === "monthly" ? "Amount per month" : "Contracted amount"}
          htmlFor="contracted_amount"
          hint={
            billingMode === "monthly"
              ? "Posted each month. Tax and deductions come off before the split."
              : undefined
          }
        >
          <Input id="contracted_amount" name="contracted_amount" inputMode="decimal" placeholder="Optional" />
        </Field>
        )}
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

/** An hourly project's default rate; new work logs start from it. */
function HourlyRateField({ currency, defaultValue }: { currency: string; defaultValue?: string }) {
  return (
    <Field
      label={`Rate per hour (${currency})`}
      htmlFor="hourly_rate"
      hint="Prefilled on every work log. Log a fixed amount instead for work priced as a set fee."
    >
      <Input
        id="hourly_rate"
        name="hourly_rate"
        type="number"
        min="0"
        step="0.01"
        placeholder="e.g. 45"
        defaultValue={defaultValue}
      />
    </Field>
  );
}

export function EditProjectForm({
  orgSlug,
  project,
  clients,
  deductions = [],
}: {
  orgSlug: string;
  project: ProjectRecord;
  clients: ClientRecord[];
  deductions?: DeductionOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [billingMode, setBillingMode] = useState<string>(project.billingMode);
  const [retainerBasis, setRetainerBasis] = useState<"fixed" | "hourly">(
    project.retainerBasis === "hourly" ? "hourly" : "fixed",
  );
  const [clientId, setClientId] = useState(project.clientId);
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function saveProject(confirmedTransfer = false) {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    if (confirmedTransfer) formData.set("confirm_financial_transfer", "yes");
    start(async () => {
      const result = await updateProjectAction(orgSlug, project.id, formData);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setConfirmTransferOpen(false);
      toast.success("Saved");
      router.refresh();
    });
  }

  return (
    <>
    <form
      ref={formRef}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (clientId !== project.clientId) {
          setConfirmTransferOpen(true);
          return;
        }
        saveProject();
      }}
    >
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={project.name} />
      </Field>
      <Field label="Client" htmlFor="project_client_id">
        <NativeSelect
          id="project_client_id"
          name="client_id"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
        >
          {clients.some((client) => client.id === project.clientId)
            ? null
            : <option value={project.clientId}>{project.clientName} · current</option>}
          {clients.map((client) => (
            <option key={client.id} value={client.id} disabled={client.currency !== project.currency}>
              {client.name}{client.currency !== project.currency ? ` · ${client.currency} unavailable` : ""}
            </option>
          ))}
        </NativeSelect>
        <p className="mt-1 text-xs text-muted-foreground">
          Client currency must match the project’s existing currency.
        </p>
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
          <NativeSelect
            id="billing_mode"
            name="billing_mode"
            defaultValue={project.billingMode}
            onChange={(event) => setBillingMode(event.target.value)}
          >
            <option value="hourly">Hourly (logs post charges)</option>
            <option value="single_charge">Single contracted charge</option>
            <option value="milestones">Milestones</option>
            <option value="manual">Manual</option>
            <option value="monthly">Monthly retainer</option>
            <option value="none">None (track only)</option>
          </NativeSelect>
        </Field>
      </div>
      {billingMode === "monthly" ? (
        <Field
          label="Retainer"
          htmlFor="retainer_basis"
          hint="Fixed posts the same amount each month. Hourly adds up the hours logged that month."
        >
          <NativeSelect
            id="retainer_basis"
            name="retainer_basis"
            value={retainerBasis}
            onChange={(event) => setRetainerBasis(event.target.value === "hourly" ? "hourly" : "fixed")}
          >
            <option value="fixed">Fixed amount</option>
            <option value="hourly">Hourly</option>
          </NativeSelect>
        </Field>
      ) : null}
      {billingMode === "hourly" || (billingMode === "monthly" && retainerBasis === "hourly") ? (
        <HourlyRateField
          currency={project.currency}
          defaultValue={
            project.hourlyRateMinor != null ? formatMajorInput(project.hourlyRateMinor, project.currency) : ""
          }
        />
      ) : null}
      <DeductionField
        orgSlug={orgSlug}
        inputName="default_fee_bps"
        defaultBps={project.defaultFeeBps}
        deductions={deductions}
      />
      <Field label="Partner earn on" htmlFor="earn_on">
        <NativeSelect id="earn_on" name="earn_on" defaultValue={project.earnOn}>
          <option value="charge">When charged</option>
          <option value="receipt">When collected</option>
        </NativeSelect>
      </Field>
      {billingMode === "monthly" && retainerBasis === "hourly" ? null : (
      <Field
        label={billingMode === "monthly" ? "Amount per month" : "Contracted amount"}
        htmlFor="contracted_amount"
        hint={
          billingMode === "monthly"
            ? "Posted each month. Tax and deductions come off before the split."
            : undefined
        }
      >
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
      )}
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
    <Dialog open={confirmTransferOpen} onOpenChange={setConfirmTransferOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer project finance records?</DialogTitle>
          <DialogDescription>
            The project and its charges, invoices, and linked payments will move from {project.clientName} to {clients.find((client) => client.id === clientId)?.name ?? "the selected client"}. This changes which client those historical records belong to; amounts and dates stay the same.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirmTransferOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" onClick={() => saveProject(true)} disabled={pending}>
            {pending ? "Transferring…" : "Transfer and save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export function ProjectSettingsSheet({
  orgSlug,
  project,
  clients,
  open,
  onOpenChange,
  canDelete = false,
  deductions = [],
}: {
  orgSlug: string;
  project: ProjectRecord;
  clients: ClientRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDelete?: boolean;
  deductions?: DeductionOption[];
}) {
  return (
    <ActionSheet
      title="Project settings"
      hideTrigger
      open={open}
      onOpenChange={onOpenChange}
    >
      <EditProjectForm orgSlug={orgSlug} project={project} clients={clients} deductions={deductions} />
      {canDelete ? <ProjectDangerZone orgSlug={orgSlug} project={project} /> : null}
    </ActionSheet>
  );
}

function ProjectDangerZone({
  orgSlug,
  project,
}: {
  orgSlug: string;
  project: ProjectRecord;
}) {
  const router = useRouter();
  return (
    <DangerZone
      className="mt-8"
      heading="Delete project"
      summary="Permanently removes milestones, tasks, work logs, and the split. This can’t be undone."
      buttonLabel="Delete project"
      title={`Delete ${project.name}?`}
      description="This permanently deletes the project with its milestones, tasks, work logs, comments, and partner split. Charges, invoices, and documents are kept but no longer linked to it."
      confirmValue={project.name}
      actionLabel="Delete this project"
      onConfirm={() => deleteProjectAction(orgSlug, project.id, project.name)}
      onDone={() => {
        toast.success(`Deleted ${project.name}`);
        router.replace(`/${orgSlug}/projects`);
        router.refresh();
      }}
    />
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
  tasks = [],
}: {
  orgSlug: string;
  projectId: string;
  billingMode: BillingMode;
  milestones: MilestoneRecord[];
  currency?: IsoCurrency;
  defaultFeeBps?: number;
  defaultHourlyRateMinor?: bigint | null;
  tasks?: { id: string; title: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [workedOn, setWorkedOn] = useState(() => toLocalInput(new Date()).slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hours, setHours] = useState("");

  function syncHours(from: string, to: string) {
    if (!from || !to) return;
    const started = new Date(`${workedOn}T${from}`);
    let ended = new Date(`${workedOn}T${to}`);
    if (ended <= started) ended = new Date(ended.getTime() + 86_400_000);
    setHours(hoursBetween(started, ended));
  }
  const [rate, setRate] = useState(
    defaultHourlyRateMinor != null
      ? formatMajorInput(defaultHourlyRateMinor, currency)
      : "",
  );
  const [fixed, setFixed] = useState("");
  const [kind, setKind] = useState<"hourly" | "fixed">("hourly");
  const posts = workLogPostsCharge(billingMode);
  const defaultRateLabel =
    defaultHourlyRateMinor != null
      ? `${formatMoney({ amountMinor: defaultHourlyRateMinor, currency })}/hr`
      : null;

  let previewMinor: bigint | null = null;
  if (posts) {
    try {
      if (kind === "fixed") {
        if (fixed.trim()) previewMinor = parseMajorToMinor(fixed, currency);
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
                : kind === "fixed"
                  ? "Posts the amount you enter, for work priced as a set fee. Hours are optional."
                  : defaultRateLabel
                    ? `Hours × ${defaultRateLabel} from project settings. Change the rate for this log if needed.`
                    : "Enter hours and a rate. Set a default rate per hour in project settings."
              : billingMode === "monthly"
                ? "These hours are added into this month's charge when you post it."
                : "Track time without billing."}
          </p>
        </div>
        {posts ? (
          <div
            role="radiogroup"
            aria-label="How this log is charged"
            className="inline-flex shrink-0 rounded-xl bg-muted/60 p-0.5 ring-1 ring-border/40"
          >
            {(
              [
                { value: "hourly", label: "Per hour" },
                { value: "fixed", label: "Fixed" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={kind === option.value}
                onClick={() => setKind(option.value)}
                className={cn(
                  "rounded-[10px] px-3 py-1 text-xs font-medium transition-colors",
                  kind === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ComposerBar prominent>
        <form
          ref={formRef}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
          action={(formData) => {
            const started = startTime ? new Date(`${workedOn}T${startTime}`) : null;
            let ended = endTime ? new Date(`${workedOn}T${endTime}`) : null;
            if (started && ended && ended <= started) ended = new Date(ended.getTime() + 86_400_000);
            if (started) formData.set("started_at", started.toISOString());
            if (ended) formData.set("ended_at", ended.toISOString());
            start(async () => {
              const result = await createWorkLogAction(orgSlug, projectId, formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success(result.charged ? "Logged and charged" : "Work logged");
              formRef.current?.reset();
              setHours("");
              setStartTime("");
              setEndTime("");
              setRate(
                defaultHourlyRateMinor != null
                  ? formatMajorInput(defaultHourlyRateMinor, currency)
                  : "",
              );
              setFixed("");
              setKind("hourly");
              router.refresh();
            });
          }}
        >
          <Input
            name="worked_on"
            type="date"
            value={workedOn}
            onChange={(event) => setWorkedOn(event.target.value)}
            className={cn(composerControlClassName, "h-10 w-40")}
            aria-label="Date"
          />
          {tasks.length > 0 ? (
            <NativeSelect
              name="task_id"
              defaultValue=""
              aria-label="Task"
              className={cn(composerControlClassName, "h-10 w-48")}
            >
              <option value="">Task (optional)</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <Input
            type="time"
            value={startTime}
            onChange={(event) => {
              setStartTime(event.target.value);
              syncHours(event.target.value, endTime);
            }}
            aria-label="Start time"
            title="Start time"
            className={cn(composerControlClassName, "h-10 w-28")}
          />
          <span className="text-xs text-muted-foreground" aria-hidden>
            to
          </span>
          <Input
            type="time"
            value={endTime}
            onChange={(event) => {
              setEndTime(event.target.value);
              syncHours(startTime, event.target.value);
            }}
            aria-label="End time"
            title="End time"
            className={cn(composerControlClassName, "h-10 w-28")}
          />
          <Input
            name="hours"
            type="number"
            min="0.001"
            step="0.001"
            placeholder={kind === "fixed" && posts ? "Hours (opt.)" : "Hours"}
            aria-label="Hours"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            className={cn(composerControlClassName, "h-10 w-28")}
          />
          {posts && kind === "hourly" ? (
            <Input
              name="hourly_rate"
              type="number"
              min="0"
              step="0.01"
              placeholder="Rate / hr"
              aria-label="Rate per hour"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              className={cn(composerControlClassName, "h-10 w-28")}
            />
          ) : null}
          {posts && kind === "fixed" ? (
            <Input
              name="fixed_amount"
              type="number"
              min="0"
              step="0.01"
              placeholder={`Amount (${currency})`}
              aria-label="Fixed amount"
              value={fixed}
              onChange={(event) => setFixed(event.target.value)}
              className={cn(composerControlClassName, "h-10 w-32")}
            />
          ) : null}
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
          toast.success(billingMode === "monthly" ? "This month posted" : "Contracted charge posted");
          router.refresh();
        });
      }}
    >
      {pending ? "Posting…" : billingMode === "monthly" ? "Post this month" : "Post contracted charge"}
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
  project,
  clients,
  canDelete = false,
  settingsOpenInitially = false,
  returnHref,
  deductions = [],
}: {
  orgSlug: string;
  project: ProjectRecord;
  clients: ClientRecord[];
  canDelete?: boolean;
  /** Opened from a `?settings=1` link; closing drops the param. */
  settingsOpenInitially?: boolean;
  returnHref?: string;
  deductions?: DeductionOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [settingsOpen, setSettingsOpen] = useState(settingsOpenInitially);
  const projectId = project.id;
  const canContracted = allowsContractedProjectCharge(project.billingMode);

  return (
    <>
    <ProjectSettingsSheet
      orgSlug={orgSlug}
      project={project}
      clients={clients}
      canDelete={canDelete}
      deductions={deductions}
      open={settingsOpen}
      onOpenChange={(next) => {
        setSettingsOpen(next);
        if (!next && settingsOpenInitially && returnHref) router.replace(returnHref, { scroll: false });
      }}
    />
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="More" />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => router.push(`/${orgSlug}/finance?client=${project.clientId}`)}
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
                toast.success(
                  project.billingMode === "monthly" ? "This month posted" : "Contracted charge posted",
                );
                router.refresh();
              });
            }}
          >
            {project.billingMode === "monthly" ? "Post this month" : "Post contracted charge"}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
          Project settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
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
