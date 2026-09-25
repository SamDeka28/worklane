"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImageUp, Pencil, Plus, Settings2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { uploadFileAction } from "@/modules/files/actions";
import {
  deleteInvoiceTemplateAction,
  saveOrgInvoiceSettingsAction,
  upsertInvoiceTemplateAction,
} from "@/modules/invoices/actions";
import type { OrgInvoiceConfig } from "@/modules/invoices/config";
import { INVOICE_LAYOUTS, type InvoiceLayout } from "@/modules/invoices/settings";
import type { InvoiceTemplate } from "@/modules/invoices/templates";
import { ExtraFieldsEditor } from "@/modules/invoices/components/extra-fields-editor";
import { percentFieldToBps } from "@/modules/invoices/components/tax-field";

type SettingsTab = "general" | "business" | "branding" | "templates";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "business", label: "Business details" },
  { id: "branding", label: "Branding" },
  { id: "templates", label: "Templates" },
];

const LAYOUT_LABEL: Record<InvoiceLayout, string> = {
  classic: "Classic",
  minimal: "Minimal",
  bold: "Bold",
};

export function InvoiceSettingsDialog({
  orgSlug,
  orgId,
  config,
  logoUrl,
  templates,
  canWrite,
  label = "Invoice settings",
}: {
  orgSlug: string;
  orgId: string;
  config: OrgInvoiceConfig;
  logoUrl: string | null;
  templates: InvoiceTemplate[];
  canWrite: boolean;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams.get("settings");
  const fromUrl = param !== null;
  const urlTab = TABS.find((item) => item.id === param)?.id ?? null;
  const [openState, setOpenState] = useState(false);
  const [tabState, setTab] = useState<SettingsTab | null>(null);
  const tab = tabState ?? urlTab ?? "general";
  const open = openState || fromUrl;

  function setOpen(next: boolean) {
    setOpenState(next);
    if (!next) {
      setTab(null);
      if (fromUrl) router.replace(pathname, { scroll: false });
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Settings2 className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <div className="shrink-0 border-b border-border/50 px-6 pt-5">
            <DialogTitle className="text-lg font-semibold">Invoice settings</DialogTitle>
            <DialogDescription className="mt-1">
              Numbering, defaults and branding for every new invoice. Issued invoices keep the
              look they were issued with.
            </DialogDescription>
            <div className="mt-4 flex gap-1" role="tablist">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors",
                    tab === item.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {tab === "templates" ? (
              <InvoiceTemplatesPanel orgSlug={orgSlug} templates={templates} canWrite={canWrite} />
            ) : (
              <InvoiceSettingsForm
                orgSlug={orgSlug}
                orgId={orgId}
                config={config}
                logoUrl={logoUrl}
                canWrite={canWrite}
                tab={tab}
                onSaved={() => setOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvoiceSettingsForm({
  orgSlug,
  orgId,
  config,
  logoUrl,
  canWrite,
  tab = "general",
  onSaved,
}: {
  orgSlug: string;
  orgId: string;
  config: OrgInvoiceConfig;
  logoUrl: string | null;
  canWrite: boolean;
  tab?: Exclude<SettingsTab, "templates">;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [logoFileId, setLogoFileId] = useState(config.brand.logoFileId);
  const [previewUrl, setPreviewUrl] = useState(logoUrl);
  const [layout, setLayout] = useState<InvoiceLayout>(config.brand.layout);
  const [accent, setAccent] = useState(config.brand.accentHex);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextPreview = `${config.numberPrefix}-${String(config.nextNumber).padStart(4, "0")}`;

  if (!canWrite) {
    return (
      <dl className="grid gap-3 text-sm">
        {[
          ["Next number", nextPreview],
          ["Due after", `${config.defaultDueDays} days`],
          ["Default tax", `${config.defaultTaxBps / 100}%`],
          ["Layout", LAYOUT_LABEL[config.brand.layout]],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 rounded-xl bg-muted/40 px-3 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Only owners and admins can change these.</p>
      </dl>
    );
  }

  return (
    <form
      className="grid gap-5"
      action={(formData) => {
        percentFieldToBps(formData, "default_tax_percent", "default_tax_bps");
        start(async () => {
          if (logoFileId) formData.set("logo_file_id", logoFileId);
          const result = await saveOrgInvoiceSettingsAction(orgSlug, formData);
          if (result.error) toast.error(result.error);
          else {
            toast.success("Invoice settings saved");
            router.refresh();
            onSaved?.();
          }
        });
      }}
    >
      <div hidden={tab !== "general"} className="grid gap-5">
        <section className="grid gap-3">
          <SectionTitle title="Numbering" hint={`The next invoice will be ${nextPreview}.`} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prefix" htmlFor="number_prefix">
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
          </div>
        </section>

        <section className="grid gap-3">
          <SectionTitle title="Defaults" hint="Pre-filled on new drafts. You can change them per invoice." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Payment due after (days)" htmlFor="default_due_days">
              <Input
                id="default_due_days"
                name="default_due_days"
                type="number"
                min={0}
                defaultValue={config.defaultDueDays}
              />
            </Field>
            <Field label="Tax rate (%)" htmlFor="default_tax_percent">
              <Input
                id="default_tax_percent"
                name="default_tax_percent"
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={config.defaultTaxBps / 100}
              />
            </Field>
          </div>
          <Field label="Payment terms" htmlFor="default_terms">
            <Textarea
              id="default_terms"
              name="default_terms"
              rows={3}
              defaultValue={config.defaultTerms}
              className="resize-none"
            />
          </Field>
          <Field label="Notes to client" htmlFor="default_memo">
            <Textarea
              id="default_memo"
              name="default_memo"
              rows={2}
              defaultValue={config.defaultMemo}
              className="resize-none"
              placeholder="Thanks for your business!"
            />
          </Field>
          <Field
            label="Payment instructions"
            htmlFor="default_payment_instructions"
            hint="Bank details, UPI ID or a payment link. Printed on every new invoice."
          >
            <Textarea
              id="default_payment_instructions"
              name="default_payment_instructions"
              rows={3}
              defaultValue={config.defaultPaymentInstructions}
              className="resize-none"
              placeholder={"Bank: …\nAccount name: …\nAccount no.: …\nIFSC / SWIFT: …"}
            />
          </Field>
        </section>
      </div>

      <div hidden={tab !== "business"} className="grid gap-5" autoCapitalize="off">
        <section className="grid gap-3">
          <SectionTitle
            title="Billed by"
            hint="Printed in the Billed by block of invoices and PDFs. Leave legal name empty to use the workspace name."
          />
          <Field label="Legal / business name" htmlFor="business_legal_name">
            <Input
              id="business_legal_name"
              name="business_legal_name"
              defaultValue={config.business.legalName}
              autoComplete="off"
              data-1p-ignore
            />
          </Field>
          <Field label="Address" htmlFor="business_address">
            <Textarea
              id="business_address"
              name="business_address"
              rows={3}
              defaultValue={config.business.address}
              className="resize-none"
              placeholder={"Street\nCity, State ZIP\nCountry"}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Billing email" htmlFor="business_email" hint="Client replies go here.">
              <Input
                id="business_email"
                name="business_email"
                type="email"
                defaultValue={config.business.email}
                autoComplete="off"
                data-1p-ignore
              />
            </Field>
            <Field label="Phone" htmlFor="business_phone">
              <Input
                id="business_phone"
                name="business_phone"
                defaultValue={config.business.phone}
                autoComplete="off"
                data-1p-ignore
              />
            </Field>
            <Field label="Tax ID" htmlFor="business_tax_id" hint="GSTIN, VAT, EIN…">
              <Input
                id="business_tax_id"
                name="business_tax_id"
                defaultValue={config.business.taxId}
                autoComplete="off"
                data-1p-ignore
              />
            </Field>
            <Field label="Website" htmlFor="business_website">
              <Input
                id="business_website"
                name="business_website"
                defaultValue={config.business.website}
                autoComplete="off"
                data-1p-ignore
              />
            </Field>
          </div>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">More details</p>
            <p className="-mt-1 text-xs text-muted-foreground">
              Registration numbers and anything else clients need, e.g. PAN, CIN, LUT, VAT or
              company number.
            </p>
            <ExtraFieldsEditor
              prefix="business_extra"
              initial={config.business.extras}
              suggestions={["PAN", "CIN", "LUT No.", "MSME / Udyam", "Company no."]}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="show_business_details"
              defaultChecked={config.brand.showBusinessDetails}
              className="rounded border-input"
            />
            Show these details on invoices
          </label>
        </section>
      </div>

      <div hidden={tab !== "branding"} className="grid gap-5">
        <section className="grid gap-3">
          <SectionTitle title="Layout" />
          <input type="hidden" name="layout" value={layout} />
          <div className="grid grid-cols-3 gap-3">
            {INVOICE_LAYOUTS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLayout(option)}
                aria-pressed={layout === option}
                className={cn(
                  "group rounded-2xl p-2 text-left ring-1 transition-all",
                  layout === option
                    ? "bg-primary/5 ring-2 ring-primary"
                    : "ring-border/60 hover:ring-border",
                )}
              >
                <LayoutThumb layout={option} accent={accent} />
                <span className="mt-2 block px-1 text-sm font-medium">{LAYOUT_LABEL[option]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3">
          <SectionTitle title="Accent colour" hint="Used for headings, totals and the bold header." />
          <div className="flex items-center gap-3">
            <input
              type="color"
              name="accent_hex"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
              aria-label="Accent colour"
              className="size-10 shrink-0 cursor-pointer rounded-xl border border-border/60 bg-transparent p-1"
            />
            <Input
              value={accent}
              onChange={(event) => {
                const next = event.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(next)) setAccent(next);
              }}
              className="max-w-[9rem] font-mono uppercase"
              aria-label="Accent hex"
            />
          </div>
        </section>

        <section className="grid gap-3">
          <SectionTitle title="Logo" hint="PNG, JPEG or WebP. Shown on the invoice and PDF." />
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border/70 p-4">
            <div className="grid h-14 w-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="max-h-10 w-auto object-contain" />
              ) : (
                <ImageUp className="size-5 text-slate-400" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
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
                    toast.success("Logo uploaded. Save to apply");
                  });
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => fileRef.current?.click()}
              >
                {previewUrl ? "Replace" : "Upload logo"}
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
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          {logoFileId ? <input type="hidden" name="logo_file_id" value={logoFileId} /> : null}
          {!logoFileId && config.brand.logoFileId ? (
            <input type="hidden" name="clear_logo" value="1" />
          ) : null}
        </section>
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-5 flex justify-end gap-2 border-t border-border/50 bg-popover px-6 py-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function LayoutThumb({ layout, accent }: { layout: InvoiceLayout; accent: string }) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-white p-2.5 ring-1 ring-black/5">
      {layout === "classic" ? (
        <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
      ) : null}
      {layout === "bold" ? (
        <div className="-mx-2.5 -mt-2.5 mb-2 h-6" style={{ backgroundColor: accent }} />
      ) : (
        <div className="mb-2 h-2 w-1/2 rounded-full" style={{ backgroundColor: accent, opacity: 0.8 }} />
      )}
      <div className="mb-1 h-1.5 w-2/3 rounded-full bg-slate-200" />
      <div className="mb-3 h-1.5 w-1/3 rounded-full bg-slate-200" />
      <div
        className="mb-1.5 h-2 rounded-sm"
        style={{ backgroundColor: layout === "classic" ? `${accent}22` : "#e2e8f0" }}
      />
      <div className="mb-1 h-1 rounded-full bg-slate-100" />
      <div className="mb-1 h-1 rounded-full bg-slate-100" />
      <div className="mb-3 h-1 rounded-full bg-slate-100" />
      <div className="ml-auto h-2 w-1/3 rounded-full" style={{ backgroundColor: accent }} />
    </div>
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

  if (creating || editing) {
    return (
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
    );
  }

  return (
    <div className="grid gap-4">
      <SectionTitle
        title="Templates"
        hint="Presets for layout, colour, terms and tax. Pick one when creating a draft."
      />
      {templates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
          No templates yet
        </p>
      ) : (
        <ul className="grid gap-2">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2.5 text-sm"
            >
              <span
                className="size-8 shrink-0 rounded-lg ring-1 ring-black/5"
                style={{ backgroundColor: template.accentHex || "#1d4ed8" }}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {template.name}
                  {template.isDefault ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      <Star className="size-2.5" />
                      Default
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {LAYOUT_LABEL[template.layout as InvoiceLayout] ?? template.layout}
                  {template.defaultDueDays != null ? ` · due in ${template.defaultDueDays} days` : ""}
                  {template.defaultTaxBps != null ? ` · ${template.defaultTaxBps / 100}% tax` : ""}
                </p>
              </div>
              {canWrite ? (
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit ${template.name}`}
                    onClick={() => setEditing(template)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${template.name}`}
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
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <Button
          type="button"
          variant="outline"
          className="justify-self-start gap-2"
          onClick={() => setCreating(true)}
        >
          <Plus className="size-4" />
          New template
        </Button>
      ) : null}
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
  const [layout, setLayout] = useState<InvoiceLayout>(
    (template?.layout as InvoiceLayout) ?? "classic",
  );
  const [accent, setAccent] = useState(template?.accentHex || "#1d4ed8");

  return (
    <form
      className="grid gap-4"
      action={(formData) => {
        percentFieldToBps(formData, "default_tax_percent", "default_tax_bps");
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
      <SectionTitle
        title={template ? `Edit ${template.name}` : "New template"}
        hint="Leave due days or tax empty to use the studio defaults."
      />
      <Field label="Name" htmlFor="tpl_name" required>
        <Input id="tpl_name" name="name" required defaultValue={template?.name ?? ""} />
      </Field>
      <input type="hidden" name="layout" value={layout} />
      <div className="grid grid-cols-3 gap-3">
        {INVOICE_LAYOUTS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLayout(option)}
            aria-pressed={layout === option}
            className={cn(
              "rounded-2xl p-2 text-left ring-1 transition-all",
              layout === option ? "bg-primary/5 ring-2 ring-primary" : "ring-border/60 hover:ring-border",
            )}
          >
            <LayoutThumb layout={option} accent={accent} />
            <span className="mt-2 block px-1 text-sm font-medium">{LAYOUT_LABEL[option]}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Accent" htmlFor="tpl_accent">
          <input
            id="tpl_accent"
            name="accent_hex"
            type="color"
            value={accent}
            onChange={(event) => setAccent(event.target.value)}
            className="h-10 w-full cursor-pointer rounded-xl border border-border/60 bg-transparent p-1"
          />
        </Field>
        <Field label="Due after (days)" htmlFor="tpl_due">
          <Input
            id="tpl_due"
            name="default_due_days"
            type="number"
            min={0}
            placeholder="Default"
            defaultValue={template?.defaultDueDays ?? ""}
          />
        </Field>
        <Field label="Tax rate (%)" htmlFor="tpl_tax">
          <Input
            id="tpl_tax"
            name="default_tax_percent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            placeholder="Default"
            defaultValue={template?.defaultTaxBps != null ? template.defaultTaxBps / 100 : ""}
          />
        </Field>
      </div>
      <Field label="Payment terms" htmlFor="tpl_terms">
        <Textarea
          id="tpl_terms"
          name="terms"
          rows={2}
          className="resize-none"
          defaultValue={template?.terms ?? ""}
        />
      </Field>
      <Field label="Notes to client" htmlFor="tpl_memo">
        <Textarea
          id="tpl_memo"
          name="memo"
          rows={2}
          className="resize-none"
          defaultValue={template?.memo ?? ""}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_default"
          defaultChecked={template?.isDefault ?? false}
          className="rounded border-input"
        />
        Use for new invoices by default
      </label>
      <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save template"}
        </Button>
      </div>
    </form>
  );
}
