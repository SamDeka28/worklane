"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SoftDocField } from "@/components/editor/soft-doc-field";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createClientAction } from "@/modules/clients/actions";
import {
  createMilestoneAction,
  createProjectAction,
  createTaskAction,
} from "@/modules/delivery/actions";
import { allowsMilestoneBilling } from "@/modules/delivery/ledger";
import type { BillingMode } from "@/modules/delivery/types";
import { updateDocumentLinksAction } from "@/modules/documents/actions";
import type { MentionItem } from "@/components/editor/rich-editor";

export type DocumentCreateType = "client" | "project" | "milestone" | "task";

export function DocumentCreateSheets({
  orgSlug,
  documentId,
  createType,
  seedName,
  open,
  onOpenChange,
  onCreated,
  clients,
  projectId,
  defaultClientId,
  billingMode = "milestones",
  milestones,
}: {
  orgSlug: string;
  documentId: string;
  createType: DocumentCreateType | null;
  seedName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (item: MentionItem | null) => void;
  clients: { id: string; name: string; currency?: string }[];
  projectId: string;
  defaultClientId?: string;
  billingMode?: BillingMode;
  milestones: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const formId = `doc-create-${createType ?? "none"}`;
  const formRef = useRef<HTMLFormElement>(null);
  const [projectClientId, setProjectClientId] = useState(defaultClientId || clients[0]?.id || "");
  const [newClientName, setNewClientName] = useState("");

  function close(result: MentionItem | null) {
    // Resolve first so parent can clear the mention promise before onOpenChange(null).
    onCreated(result);
    onOpenChange(false);
  }

  if (!createType) return null;

  const titles: Record<DocumentCreateType, string> = {
    client: "New client",
    project: "New project",
    milestone: "New milestone",
    task: "New task",
  };

  const descriptions: Record<DocumentCreateType, string> = {
    client: "Full client record, then insert as an @ tag.",
    project: "Project fields plus client. Links this document automatically.",
    milestone: "Name, status, amount, due date, and description for the linked project.",
    task: "Board task with priority, due date, and optional milestone.",
  };

  return (
    <ActionSheet
      title={titles[createType]}
      description={descriptions[createType]}
      hideTrigger
      side="right"
      open={open}
      onOpenChange={(next) => {
        if (!next) close(null);
      }}
      footer={
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => close(null)}
          >
            Cancel
          </Button>
          <Button type="submit" form={formId} size="lg" className="flex-[1.4]" disabled={pending}>
            {pending ? "Creating…" : "Create & insert"}
          </Button>
        </div>
      }
    >
      {createType === "client" ? (
        <form
          id={formId}
          ref={formRef}
          className="grid gap-4"
          action={(formData) => {
            start(async () => {
              const result = await createClientAction(orgSlug, formData);
              if (result.error || !result.id) {
                toast.error(result.error ?? "Could not create client");
                return;
              }
              const name = String(formData.get("name") ?? "").trim();
              await updateDocumentLinksAction(orgSlug, documentId, { clientId: result.id });
              toast.success("Client created");
              close({ id: result.id, label: name, type: "client" });
              router.refresh();
            });
          }}
        >
          <Field label="Kind" htmlFor="doc_client_kind">
            <NativeSelect id="doc_client_kind" name="kind" defaultValue="company">
              <option value="company">Company</option>
              <option value="person">Person</option>
            </NativeSelect>
          </Field>
          <Field label="Name" htmlFor="doc_client_name" required>
            <Input
              id="doc_client_name"
              name="name"
              required
              defaultValue={seedName}
              placeholder="Acme Co"
            />
          </Field>
          <Field label="Currency" htmlFor="doc_client_currency">
            <NativeSelect id="doc_client_currency" name="currency" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </NativeSelect>
          </Field>
          <div className="grid gap-3 rounded-2xl bg-muted/40 p-3 ring-1 ring-border/40">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              Primary contact
            </p>
            <Field label="Contact name" htmlFor="doc_contact_name">
              <Input id="doc_contact_name" name="contact_name" placeholder="Optional" />
            </Field>
            <Field label="Email" htmlFor="doc_contact_email">
              <Input id="doc_contact_email" name="email" type="email" />
            </Field>
            <Field label="Phone" htmlFor="doc_contact_phone">
              <Input id="doc_contact_phone" name="phone" />
            </Field>
          </div>
        </form>
      ) : null}

      {createType === "project" ? (
        <form
          id={formId}
          ref={formRef}
          className="grid gap-4"
          action={(formData) => {
            start(async () => {
              let clientId = projectClientId;
              if (!clientId) {
                const fresh = newClientName.trim();
                if (!fresh) {
                  toast.error("Choose a client or enter a new client name");
                  return;
                }
                const created = await createClientAction(orgSlug, (() => {
                  const data = new FormData();
                  data.set("kind", "company");
                  data.set("name", fresh);
                  data.set("currency", "USD");
                  return data;
                })());
                if (created.error || !created.id) {
                  toast.error(created.error ?? "Could not create client");
                  return;
                }
                clientId = created.id;
              }
              formData.set("client_id", clientId);
              formData.set("document_id", documentId);
              const result = await createProjectAction(orgSlug, formData);
              if (result.error || !result.id) {
                toast.error(result.error ?? "Could not create project");
                return;
              }
              const name = String(formData.get("name") ?? "").trim();
              toast.success("Project created");
              close({ id: result.id, label: name, type: "project" });
              router.refresh();
            });
          }}
        >
          <Field label="Name" htmlFor="doc_project_name" required>
            <Input
              id="doc_project_name"
              name="name"
              required
              defaultValue={seedName}
              placeholder="Website redesign"
            />
          </Field>
          <Field label="Client" htmlFor="doc_project_client">
            <NativeSelect
              id="doc_project_client"
              value={projectClientId}
              onChange={(event) => setProjectClientId(event.target.value)}
            >
              <option value="">Create new client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {!projectClientId ? (
            <Field label="New client name" htmlFor="doc_project_new_client" required>
              <Input
                id="doc_project_new_client"
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
                placeholder="Marie"
              />
            </Field>
          ) : null}
          <Field label="Status" htmlFor="doc_project_status">
            <NativeSelect id="doc_project_status" name="status" defaultValue="planning">
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
            </NativeSelect>
          </Field>
          <Field label="Billing" htmlFor="doc_project_billing">
            <NativeSelect id="doc_project_billing" name="billing_mode" defaultValue="milestones">
              <option value="milestones">Milestones</option>
              <option value="hourly">Hourly</option>
              <option value="single_charge">Single charge</option>
              <option value="manual">Manual</option>
              <option value="none">None</option>
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" htmlFor="doc_project_starts">
              <Input id="doc_project_starts" name="starts_on" type="date" />
            </Field>
            <Field label="Due" htmlFor="doc_project_due">
              <Input id="doc_project_due" name="due_on" type="date" />
            </Field>
          </div>
          <SoftDocField
            label="Scope notes"
            name="scope"
            orgSlug={orgSlug}
            entityType="document"
            entityId={documentId}
            placeholder="Optional project scope…"
            minHeightClassName="min-h-24"
          />
        </form>
      ) : null}

      {createType === "milestone" ? (
        <form
          id={formId}
          ref={formRef}
          className="grid gap-4"
          action={(formData) => {
            start(async () => {
              if (!projectId) {
                toast.error("Link a project in Context first");
                return;
              }
              const result = await createMilestoneAction(orgSlug, projectId, formData);
              if (result.error || !result.id) {
                toast.error(result.error ?? "Could not create milestone");
                return;
              }
              const name =
                ("name" in result && typeof result.name === "string" && result.name) ||
                String(formData.get("name") ?? "").trim();
              toast.success("Milestone created");
              close({ id: result.id, label: name, type: "milestone" });
              router.refresh();
            });
          }}
        >
          {!projectId ? (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              Link a project in the Context rail before creating a milestone.
            </p>
          ) : null}
          <Field label="Name" htmlFor="doc_milestone_name" required>
            <Input
              id="doc_milestone_name"
              name="name"
              required
              defaultValue={seedName}
              placeholder="Discovery"
              disabled={!projectId}
            />
          </Field>
          <Field label="Delivery status" htmlFor="doc_milestone_status">
            <NativeSelect id="doc_milestone_status" name="status" defaultValue="planned">
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Done</option>
              <option value="cancelled">Cancelled</option>
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" htmlFor="doc_milestone_amount">
              <Input
                id="doc_milestone_amount"
                name="amount"
                inputMode="decimal"
                placeholder="Optional"
              />
            </Field>
            <Field label="Due" htmlFor="doc_milestone_due">
              <Input id="doc_milestone_due" name="due_on" type="date" />
            </Field>
          </div>
          <SoftDocField
            label="Description"
            name="description"
            orgSlug={orgSlug}
            entityType="project"
            entityId={projectId || documentId}
            placeholder="Context for this milestone…"
            minHeightClassName="min-h-28"
          />
          {!allowsMilestoneBilling(billingMode) ? (
            <p className="text-xs text-muted-foreground">
              Amount is reference only for this billing mode.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Amount can be charged later from the project.
            </p>
          )}
        </form>
      ) : null}

      {createType === "task" ? (
        <form
          id={formId}
          ref={formRef}
          className="grid gap-4"
          action={(formData) => {
            start(async () => {
              if (!projectId) {
                toast.error("Link a project in Context first");
                return;
              }
              const result = await createTaskAction(orgSlug, projectId, formData);
              if (result.error || !("id" in result) || !result.id) {
                toast.error(result.error ?? "Could not create task");
                return;
              }
              const title =
                ("title" in result && typeof result.title === "string" && result.title) ||
                String(formData.get("title") ?? "").trim();
              toast.success("Task created");
              close({ id: result.id, label: title, type: "task" });
              router.refresh();
            });
          }}
        >
          {!projectId ? (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              Link a project in the Context rail before creating a task.
            </p>
          ) : null}
          <Field label="Title" htmlFor="doc_task_title" required>
            <Input
              id="doc_task_title"
              name="title"
              required
              defaultValue={seedName}
              placeholder="Ship homepage…"
              disabled={!projectId}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority" htmlFor="doc_task_priority">
              <NativeSelect id="doc_task_priority" name="priority" defaultValue="medium">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </NativeSelect>
            </Field>
            <Field label="Due" htmlFor="doc_task_due">
              <Input id="doc_task_due" name="due_on" type="date" />
            </Field>
          </div>
          {milestones.length > 0 ? (
            <Field label="Milestone" htmlFor="doc_task_milestone">
              <NativeSelect id="doc_task_milestone" name="milestone_id" defaultValue="">
                <option value="">None</option>
                {milestones.map((item, index) => (
                  <option key={item.id} value={item.id}>
                    {`M${index + 1} · ${item.name}`}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Description" htmlFor="doc_task_description">
            <Input id="doc_task_description" name="description" placeholder="Optional" />
          </Field>
        </form>
      ) : null}
    </ActionSheet>
  );
}
