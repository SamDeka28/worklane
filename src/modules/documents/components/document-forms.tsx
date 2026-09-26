"use client";

import { FilePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createDocumentAction } from "@/modules/documents/actions";
import { DOCUMENT_TEMPLATES, getDocumentTemplate } from "@/modules/documents/templates";
import { DOCUMENT_KIND_LABEL, DOCUMENT_KINDS } from "@/modules/documents/types";

export function CreateDocumentDialog({
  orgSlug,
  clients,
  projects,
  defaultOpen = false,
  defaultClientId,
  defaultProjectId,
  triggerLabel = "New document",
  triggerVariant = "default",
}: {
  orgSlug: string;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; clientId: string }[];
  defaultOpen?: boolean;
  defaultClientId?: string;
  defaultProjectId?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const [templateId, setTemplateId] = useState("proposal");
  const selectedTemplate = getDocumentTemplate(templateId);

  return (
    <ActionSheet
      title="New document"
        description="Pick a template and context: client and project are filled in for you."
      triggerLabel={triggerLabel}
      triggerIcon={<FilePlus />}
      triggerVariant={triggerVariant}
      open={open}
      onOpenChange={setOpen}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await createDocumentAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Document created");
            setOpen(false);
            router.push(`/${orgSlug}/documents/${result.id}`);
            router.refresh();
          });
        }}
      >
        <Field label="Title" htmlFor="doc_title" required>
          <Input id="doc_title" name="title" required placeholder="Website redesign proposal" />
        </Field>
        <Field label="Template" htmlFor="doc_template" hint={selectedTemplate?.description}>
          <NativeSelect
            id="doc_template"
            name="template_id"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            {DOCUMENT_KINDS.map((kind) => {
              const options = DOCUMENT_TEMPLATES.filter((t) => t.kind === kind);
              if (options.length === 0) return null;
              return (
                <optgroup key={kind} label={DOCUMENT_KIND_LABEL[kind]}>
                  {options.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </NativeSelect>
        </Field>
        <Field label="Client" htmlFor="doc_client">
          <NativeSelect
            id="doc_client"
            name="client_id"
            defaultValue={defaultClientId ?? ""}
          >
            <option value="">None</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Project" htmlFor="doc_project">
          <NativeSelect
            id="doc_project"
            name="project_id"
            defaultValue={defaultProjectId ?? ""}
          >
            <option value="">None</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </form>
    </ActionSheet>
  );
}
