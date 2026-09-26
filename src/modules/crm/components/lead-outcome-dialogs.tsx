"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { convertLeadToClientAction } from "@/modules/crm/actions";
import {
  findLeadDuplicatesAction,
  listClientOptionsAction,
} from "@/modules/crm/follow-actions";
import type { LeadRecord } from "@/modules/crm/types";

export function LostReasonDialog({
  open,
  leadName,
  reasons,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  leadName: string;
  reasons: string[];
  onCancel: () => void;
  onConfirm: (outcome: { lostReason: string; lostNote: string }) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why was {leadName} lost?</DialogTitle>
          <DialogDescription>
            Reasons feed your reports, so you can see what to fix.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Lost reason" className="flex flex-wrap gap-2">
          {reasons.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={reason === option}
              onClick={() => setReason(option)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-colors",
                reason === option
                  ? "bg-foreground text-background ring-foreground"
                  : "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Anything to remember (optional)"
          rows={2}
          maxLength={1000}
          aria-label="Note"
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!reason || pending}
            onClick={() => {
              start(async () => {
                const ok = await onConfirm({ lostReason: reason, lostNote: note });
                if (ok) {
                  setReason("");
                  setNote("");
                }
              });
            }}
          >
            {pending ? "Saving…" : "Mark as lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Won: create or pick the client, optionally start a project, in one step. */
export function ConvertLeadDialog({
  orgSlug,
  lead,
  open,
  onOpenChange,
  onSkip,
  skipLabel = "Just mark as won",
}: {
  orgSlug: string;
  lead: LeadRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Close without converting (the lead is already, or will be, marked won). */
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [suggested, setSuggested] = useState<{ id: string; name: string; why: string }[]>([]);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [clientId, setClientId] = useState("");
  const [createProject, setCreateProject] = useState(true);
  const [projectName, setProjectName] = useState(`${lead.name} engagement`);
  const upsell = Boolean(lead.clientId);

  useEffect(() => {
    if (!open || upsell) return;
    let cancelled = false;
    void Promise.all([
      listClientOptionsAction(orgSlug),
      findLeadDuplicatesAction(orgSlug, {
        name: lead.name,
        company: lead.company ?? undefined,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        excludeLeadId: lead.id,
      }),
    ]).then(([options, matches]) => {
      if (cancelled) return;
      setClients(options);
      setSuggested(matches.clients);
      if (matches.clients[0]) {
        setMode("existing");
        setClientId(matches.clients[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, upsell, orgSlug, lead.id, lead.name, lead.company, lead.email, lead.phone]);

  const newName = lead.company?.trim() || lead.name;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{upsell ? `Won: ${lead.name}` : `Won! Make ${newName} a client?`}</DialogTitle>
          <DialogDescription>
            {upsell
              ? "This deal belongs to an existing client. Start the project now?"
              : "Contact details, notes, and proposals carry over, so there’s no retyping."}
          </DialogDescription>
        </DialogHeader>

        {!upsell ? (
          <div className="grid gap-2">
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition-colors",
                mode === "new" ? "bg-primary/8 ring-primary/40" : "ring-foreground/10",
              )}
            >
              <input
                type="radio"
                name="convert_mode"
                checked={mode === "new"}
                onChange={() => setMode("new")}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">New client: {newName}</span>
                <span className="block text-xs text-muted-foreground">
                  {lead.company ? "Company" : "Person"} with {lead.contactName || lead.email || "this lead"} as the primary contact
                </span>
              </span>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition-colors",
                mode === "existing" ? "bg-primary/8 ring-primary/40" : "ring-foreground/10",
              )}
            >
              <input
                type="radio"
                name="convert_mode"
                checked={mode === "existing"}
                onChange={() => setMode("existing")}
                className="mt-1"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Add to an existing client</span>
                {suggested.length > 0 ? (
                  <span className="block text-xs text-amber-700 dark:text-amber-300">
                    Looks like {suggested[0].name} ({suggested[0].why.toLowerCase()})
                  </span>
                ) : null}
                {mode === "existing" ? (
                  <NativeSelect
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    className="mt-2 w-full"
                    aria-label="Client"
                  >
                    <option value="">Pick a client…</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </NativeSelect>
                ) : null}
              </span>
            </label>
          </div>
        ) : null}

        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={createProject}
            onChange={(event) => setCreateProject(event.target.checked)}
          />
          Start a project
        </label>
        {createProject ? (
          <Field label="Project name" htmlFor={`convert_project_${lead.id}`}>
            <Input
              id={`convert_project_${lead.id}`}
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              maxLength={160}
            />
          </Field>
        ) : null}

        <DialogFooter>
          {onSkip ? (
            <Button type="button" variant="ghost" onClick={onSkip} disabled={pending}>
              {skipLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={
              pending ||
              (!upsell && mode === "existing" && !clientId) ||
              (upsell && !createProject)
            }
            onClick={() => {
              start(async () => {
                const fd = new FormData();
                if (createProject) {
                  fd.set("create_project", "1");
                  fd.set("project_name", projectName);
                }
                if (!upsell && mode === "existing") fd.set("existing_client_id", clientId);
                const result = await convertLeadToClientAction(orgSlug, lead.id, fd);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success(upsell ? "Project started" : "Became a client");
                onOpenChange(false);
                router.push(
                  result.projectId
                    ? `/${orgSlug}/projects/${result.projectId}`
                    : `/${orgSlug}/clients/${result.clientId}`,
                );
              });
            }}
          >
            {pending
              ? "Working…"
              : upsell
                ? "Start project"
                : createProject
                  ? "Create client and project"
                  : "Create client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
