"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveEmailTemplatesAction } from "@/modules/crm/settings-actions";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_MERGE_FIELDS,
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

  return (
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">
        Placeholders:{" "}
        {EMAIL_MERGE_FIELDS.map((field, index) => (
          <span key={field.key}>
            {index > 0 ? ", " : ""}
            <code className="rounded bg-card px-1 py-0.5 text-[11px] ring-1 ring-foreground/8" title={field.label}>
              {`{{${field.key}}}`}
            </code>
          </span>
        ))}
      </p>
      <ul className="grid gap-2">
        {templates.map((template) => {
          const open = openId === template.id;
          return (
            <li key={template.id} className="rounded-xl bg-card ring-1 ring-foreground/5">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : template.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
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
                <div className="grid gap-2.5 border-t border-border/60 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
                    <Input
                      value={template.name}
                      maxLength={60}
                      aria-label="Template name"
                      placeholder="Template name"
                      onChange={(event) => patch(template.id, { name: event.target.value })}
                    />
                    <NativeSelect
                      aria-label="Used for"
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
                  </div>
                  <Input
                    value={template.subject}
                    maxLength={200}
                    aria-label="Subject"
                    placeholder="Subject"
                    onChange={(event) => patch(template.id, { subject: event.target.value })}
                  />
                  <Textarea
                    value={template.body}
                    rows={8}
                    maxLength={10_000}
                    aria-label="Message"
                    onChange={(event) => patch(template.id, { body: event.target.value })}
                  />
                  <div>
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
