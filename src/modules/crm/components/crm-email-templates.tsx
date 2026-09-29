"use client";

import { useRef, useState } from "react";
import { useActionProgress as useTransition } from "@/components/studio/use-action-progress";
import { Braces, ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { Field } from "@/components/studio/field";
import {
  VariableChips,
  VariableField,
  insertVariableAt,
  type FieldElement,
} from "@/modules/crm/components/email-variables";
import { saveEmailTemplatesAction } from "@/modules/crm/settings-actions";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_PURPOSES,
  type EmailTemplatePurpose,
  type LeadEmailTemplate,
} from "@/modules/crm/settings";

export function CrmEmailTemplates({
  orgSlug,
  templates: initial,
}: {
  orgSlug: string;
  templates: LeadEmailTemplate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [templates, setTemplates] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const subjectRef = useRef<FieldElement | null>(null);
  const bodyRef = useRef<FieldElement | null>(null);
  const lastField = useRef<FieldElement | null>(null);

  function patch(id: string, change: Partial<LeadEmailTemplate>) {
    setTemplates((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }

  function save(next = templates) {
    start(async () => {
      const result = await saveEmailTemplatesAction(orgSlug, next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Templates saved");
      router.refresh();
    });
  }

  function insert(el: FieldElement, text: string, template: LeadEmailTemplate) {
    if (el === subjectRef.current) {
      insertVariableAt(el, template.subject, text, (subject) => patch(template.id, { subject }));
    } else {
      insertVariableAt(el, template.body, text, (body) => patch(template.id, { body }));
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
        <Braces className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          Type <kbd className="rounded bg-card px-1 font-sans font-semibold text-foreground ring-1 ring-foreground/10">@</kbd>{" "}
          in a subject or message to insert a variable like first name or company. It’s filled in
          from the lead when the email is sent.
        </p>
      </div>
      <ul className="grid gap-2.5">
        {templates.map((template) => {
          const open = openId === template.id;
          return (
            <li key={template.id} className="rounded-xl bg-card ring-1 ring-foreground/5">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : template.id)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {template.name || "Untitled"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {EMAIL_TEMPLATE_PURPOSES.find((item) => item.value === template.purpose)?.label}
                </span>
                <ChevronDown
                  className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
                />
              </button>
              {open ? (
                <div className="grid gap-4 border-t border-border/60 px-4 pt-4 pb-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
                    <Field label="Name" htmlFor={`${template.id}_name`}>
                      <Input
                        id={`${template.id}_name`}
                        value={template.name}
                        maxLength={60}
                        placeholder="Template name"
                        onChange={(event) => patch(template.id, { name: event.target.value })}
                      />
                    </Field>
                    <Field label="Used for" htmlFor={`${template.id}_purpose`}>
                      <NativeSelect
                        id={`${template.id}_purpose`}
                        value={template.purpose}
                        onChange={(event) =>
                          patch(template.id, { purpose: event.target.value as EmailTemplatePurpose })
                        }
                      >
                        {EMAIL_TEMPLATE_PURPOSES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                  </div>
                  <Field label="Subject" htmlFor={`${template.id}_subject`}>
                    <VariableField
                      id={`${template.id}_subject`}
                      value={template.subject}
                      onValueChange={(subject) => patch(template.id, { subject })}
                      values={{}}
                      fieldRef={subjectRef}
                      onFocusField={(el) => (lastField.current = el)}
                      maxLength={200}
                      placeholder="Subject line"
                    />
                  </Field>
                  <Field label="Message" htmlFor={`${template.id}_body`}>
                    <VariableField
                      id={`${template.id}_body`}
                      multiline
                      value={template.body}
                      onValueChange={(body) => patch(template.id, { body })}
                      values={{}}
                      fieldRef={bodyRef}
                      onFocusField={(el) => (lastField.current = el)}
                      rows={8}
                      maxLength={10_000}
                      className="leading-6"
                      placeholder="Write the email. Type @ to insert a variable."
                    />
                  </Field>
                  <VariableChips
                    values={{}}
                    highlightMissing={false}
                    target={lastField}
                    fallback={bodyRef}
                    onInsert={(el, text) => insert(el, text, template)}
                  />
                  <div className="-ml-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setTemplates((list) => list.filter((item) => item.id !== template.id))}
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => save()}>
          Save templates
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const id = `t${Date.now().toString(36)}`;
            setTemplates((list) => [
              ...list,
              { id, name: "New template", purpose: "custom", subject: "", body: "Hi {{first_name}},\n\n\n\nBest,\n{{my_name}}" },
            ]);
            setOpenId(id);
          }}
        >
          <Plus className="size-3.5" />
          Add template
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Replace your templates with the built-in set?")) return;
            setTemplates(DEFAULT_EMAIL_TEMPLATES);
            save(DEFAULT_EMAIL_TEMPLATES);
          }}
        >
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
