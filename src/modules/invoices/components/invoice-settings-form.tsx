"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { uploadFileAction } from "@/modules/files/actions";
import {
  deleteInvoiceTemplateAction,
  saveOrgInvoiceSettingsAction,
  upsertInvoiceTemplateAction,
} from "@/modules/invoices/actions";
import type { OrgInvoiceConfig } from "@/modules/invoices/config";
import type { InvoiceTemplate } from "@/modules/invoices/templates";

export function InvoiceSettingsForm({
  orgSlug,
  orgId,
  config,
  logoUrl,
  canWrite,
}: {
  orgSlug: string;
  orgId: string;
  config: OrgInvoiceConfig;
  logoUrl: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [logoFileId, setLogoFileId] = useState(config.brand.logoFileId);
  const [previewUrl, setPreviewUrl] = useState(logoUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!canWrite) {
    return (
      <p className="text-sm text-muted-foreground">
        {config.numberPrefix}-{String(config.nextNumber).padStart(4, "0")} · due{" "}
        {config.defaultDueDays}d · {config.brand.layout}
      </p>
    );
  }

  return (
    <form
      className="grid gap-4"
      action={(formData) => {
        start(async () => {
          if (logoFileId) formData.set("logo_file_id", logoFileId);
          const result = await saveOrgInvoiceSettingsAction(orgSlug, formData);
          if (result.error) toast.error(result.error);
          else {
            toast.success("Invoice settings saved");
            router.refresh();
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Number prefix" htmlFor="number_prefix">
          <Input
            id="number_prefix"
            name="number_prefix"
            defaultValue={config.numberPrefix}
            maxLength={12}
          />
        </Field>
        <Field label="Next number" htmlFor="next_number">
          <Input
            id="next_number"
            name="next_number"
            type="number"
            min={1}
            defaultValue={config.nextNumber}
          />
        </Field>
        <Field label="Default due days" htmlFor="default_due_days">
          <Input
            id="default_due_days"
            name="default_due_days"
            type="number"
            min={0}
            defaultValue={config.defaultDueDays}
          />
        </Field>
        <Field label="Default tax (bps)" htmlFor="default_tax_bps">
          <Input
            id="default_tax_bps"
            name="default_tax_bps"
            type="number"
            min={0}
            max={10000}
            defaultValue={config.defaultTaxBps}
          />
        </Field>
      </div>

      <Field label="Default terms" htmlFor="default_terms">
        <Textarea
          id="default_terms"
          name="default_terms"
          rows={3}
          defaultValue={config.defaultTerms}
        />
      </Field>
      <Field label="Default memo" htmlFor="default_memo">
        <Textarea
          id="default_memo"
          name="default_memo"
          rows={2}
          defaultValue={config.defaultMemo}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Accent color" htmlFor="accent_hex">
          <Input
            id="accent_hex"
            name="accent_hex"
            type="color"
            defaultValue={config.brand.accentHex}
            className="h-10 w-full p-1"
          />
        </Field>
        <Field label="Layout" htmlFor="layout">
          <NativeSelect id="layout" name="layout" defaultValue={config.brand.layout}>
            <option value="classic">Classic</option>
            <option value="minimal">Minimal</option>
            <option value="bold">Bold</option>
          </NativeSelect>
        </Field>
      </div>

      <div className="lane-inset p-3">
        <p className="text-sm font-medium">Logo</p>
        <p className="mt-0.5 text-xs text-muted-foreground">PNG or JPEG, used on preview and PDF</p>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="mt-3 h-10 w-auto object-contain" />
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              start(async () => {
                const fd = new FormData();
                fd.set("file", file);
                fd.set("entity_type", "organization");
                fd.set("entity_id", orgId);
                fd.set("visibility", "shared");
                const result = await uploadFileAction(orgSlug, fd);
                if (result.error || !result.id) {
                  toast.error(result.error ?? "Upload failed");
                  return;
                }
                setLogoFileId(result.id);
                setPreviewUrl(result.url ?? previewUrl);
                toast.success("Logo uploaded — save settings");
              });
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Upload logo
          </Button>
          {logoFileId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLogoFileId(null);
                setPreviewUrl(null);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        {logoFileId ? <input type="hidden" name="logo_file_id" value={logoFileId} /> : null}
        {!logoFileId && config.brand.logoFileId ? (
          <input type="hidden" name="clear_logo" value="1" />
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="show_org_address"
          defaultChecked={config.brand.showOrgAddress}
          className="rounded border-input"
        />
        Show org address block (when available)
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save invoice settings"}
      </Button>
    </form>
  );
}

export function InvoiceTemplatesPanel({
  orgSlug,
  templates,
  canWrite,
}: {
  orgSlug: string;
  templates: InvoiceTemplate[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<InvoiceTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  if (!canWrite) {
    return (
      <ul className="space-y-2 text-sm">
        {templates.map((template) => (
          <li key={template.id} className="rounded-2xl bg-muted/40 px-3 py-2">
            {template.name}
            {template.isDefault ? " · default" : ""} · {template.layout}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {templates.map((template) => (
          <li
            key={template.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/40 px-3 py-2.5 text-sm"
          >
            <div>
              <p className="font-medium">
                {template.name}
                {template.isDefault ? (
                  <span className="ml-2 text-[11px] text-muted-foreground">default</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{template.layout}</p>
            </div>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(template)}>
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await deleteInvoiceTemplateAction(orgSlug, template.id);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success("Template deleted");
                      router.refresh();
                    }
                  });
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {creating || editing ? (
        <TemplateEditor
          orgSlug={orgSlug}
          template={editing}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      ) : (
        <Button type="button" variant="outline" onClick={() => setCreating(true)}>
          New template
        </Button>
      )}
    </div>
  );
}

function TemplateEditor({
  orgSlug,
  template,
  onCancel,
  onSaved,
}: {
  orgSlug: string;
  template: InvoiceTemplate | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3 lane-panel p-4"
      action={(formData) => {
        start(async () => {
          if (template) formData.set("template_id", template.id);
          const result = await upsertInvoiceTemplateAction(orgSlug, formData);
          if (result.error) toast.error(result.error);
          else {
            toast.success(template ? "Template updated" : "Template created");
            onSaved();
          }
        });
      }}
    >
      <p className="text-sm font-medium">{template ? "Edit template" : "New template"}</p>
      <Field label="Name" htmlFor="tpl_name" required>
        <Input id="tpl_name" name="name" required defaultValue={template?.name ?? ""} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Layout" htmlFor="tpl_layout">
          <NativeSelect id="tpl_layout" name="layout" defaultValue={template?.layout ?? "classic"}>
            <option value="classic">Classic</option>
            <option value="minimal">Minimal</option>
            <option value="bold">Bold</option>
          </NativeSelect>
        </Field>
        <Field label="Accent (optional)" htmlFor="tpl_accent">
          <Input
            id="tpl_accent"
            name="accent_hex"
            type="color"
            defaultValue={template?.accentHex ?? "#1d4ed8"}
            className="h-10 w-full p-1"
          />
        </Field>
        <Field label="Due days override" htmlFor="tpl_due">
          <Input
            id="tpl_due"
            name="default_due_days"
            type="number"
            min={0}
            defaultValue={template?.defaultDueDays ?? ""}
          />
        </Field>
        <Field label="Tax bps override" htmlFor="tpl_tax">
          <Input
            id="tpl_tax"
            name="default_tax_bps"
            type="number"
            min={0}
            max={10000}
            defaultValue={template?.defaultTaxBps ?? ""}
          />
        </Field>
      </div>
      <Field label="Terms" htmlFor="tpl_terms">
        <Textarea id="tpl_terms" name="terms" rows={2} defaultValue={template?.terms ?? ""} />
      </Field>
      <Field label="Memo" htmlFor="tpl_memo">
        <Textarea id="tpl_memo" name="memo" rows={2} defaultValue={template?.memo ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_default"
          defaultChecked={template?.isDefault ?? false}
          className="rounded border-input"
        />
        Default for new invoices
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save template"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
