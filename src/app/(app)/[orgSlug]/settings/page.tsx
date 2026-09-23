import Link from "next/link";
import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { listClients } from "@/modules/clients/queries";
import { OrgSettingsForm } from "@/modules/identity/components/org-settings-form";
import { requireOrg } from "@/modules/identity/org";
import {
  InvoiceSettingsForm,
  InvoiceTemplatesPanel,
} from "@/modules/invoices/components/invoice-settings-form";
import { loadOrgInvoiceConfig, resolveInvoiceBrand } from "@/modules/invoices/config";
import { ensureDefaultInvoiceTemplates } from "@/modules/invoices/templates";
import { listPartners } from "@/modules/partners/queries";
import {
  CreateShareGrantForm,
  ShareGrantList,
} from "@/modules/portal/components/share-grant-forms";
import { listShareGrants } from "@/modules/portal/queries";
import { isEmailConfigured } from "@/shared/email";

function FormSection({
  title,
  hint,
  children,
  id,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-4 border-b border-border/50 pb-6 last:border-b-0 last:pb-0"
    >
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage({
  params,
}: PageProps<"/[orgSlug]/settings">) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const [clients, partners, grants] = await Promise.all([
    ctx.org.modules.portal ? listClients(orgSlug) : Promise.resolve([]),
    ctx.org.modules.portal ? listPartners(orgSlug) : Promise.resolve([]),
    ctx.org.modules.portal ? listShareGrants(orgSlug) : Promise.resolve([]),
  ]);

  const [invoiceConfig, templates, brand] = ctx.org.modules.finance
    ? await Promise.all([
        loadOrgInvoiceConfig(orgSlug),
        ensureDefaultInvoiceTemplates(orgSlug),
        resolveInvoiceBrand(orgSlug),
      ])
    : [null, [], null];

  return (
    <WorkSurface>
      <StudioToolbar
        purpose="Studio settings"
        subtitle={ctx.org.slug}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>Currency {ctx.org.defaultCurrency}</span>
          <span aria-hidden>·</span>
          <span>
            Role <span className="capitalize text-foreground">{ctx.role}</span>
          </span>
          <span aria-hidden>·</span>
          <span>Email {isEmailConfigured() ? "connected" : "not configured"}</span>
          <span aria-hidden>·</span>
          <Link href={`/${orgSlug}/team`} className="font-medium text-foreground hover:underline">
            Manage team
          </Link>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-2 xl:grid-cols-12 xl:gap-10">
          <div className="space-y-6 xl:col-span-5">
            <FormSection
              title="Your profile"
              hint="Name and photo used across the studio"
            >
              <Link
                href={`/${orgSlug}/profile`}
                className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
              >
                Edit profile
              </Link>
            </FormSection>

            <FormSection title="Studio" hint="Name and account">
              <OrgSettingsForm orgSlug={orgSlug} name={ctx.org.name} canWrite={ctx.canWrite} />
            </FormSection>

            {ctx.org.modules.portal && ctx.canWrite ? (
              <FormSection
                title="Portal"
                hint="Hashed share links: tokens shown once"
              >
                <CreateShareGrantForm
                  orgSlug={orgSlug}
                  clients={clients.map((c) => ({ id: c.id, name: c.name }))}
                  partners={partners.map((p) => ({ id: p.id, name: p.name }))}
                />
                <div className="mt-4 border-t border-border/40 pt-4">
                  <ShareGrantList orgSlug={orgSlug} grants={grants} />
                </div>
              </FormSection>
            ) : null}
          </div>

          <div className="space-y-6 xl:col-span-7" id="invoices">
            {ctx.org.modules.finance && invoiceConfig ? (
              <>
                <FormSection
                  title="Invoices"
                  hint="Numbering, defaults, brand, and layout"
                >
                  <InvoiceSettingsForm
                    orgSlug={orgSlug}
                    orgId={ctx.org.id}
                    config={invoiceConfig}
                    logoUrl={brand?.logoUrl ?? null}
                    canWrite={ctx.canWrite}
                  />
                </FormSection>
                <FormSection
                  title="Templates"
                  hint="Presets applied when creating drafts"
                >
                  <InvoiceTemplatesPanel
                    orgSlug={orgSlug}
                    templates={templates}
                    canWrite={ctx.canWrite}
                  />
                </FormSection>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Finance module is off.</p>
            )}
          </div>
        </div>
      </div>
    </WorkSurface>
  );
}
