import Link from "next/link";
import { SoftCard, StudioToolbar, WorkSurface } from "@/components/studio/chrome";
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
      <StudioToolbar title="Studio" subtitle={ctx.org.slug} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>Currency {ctx.org.defaultCurrency}</span>
          <span aria-hidden>·</span>
          <span>
            Role <span className="capitalize text-foreground">{ctx.role}</span>
          </span>
          <span aria-hidden>·</span>
          <span>Email {isEmailConfigured() ? "connected" : "not configured"}</span>
          <span aria-hidden>·</span>
          <Link href={`/${orgSlug}/team`} className="text-foreground hover:underline">
            Manage team
          </Link>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-12 xl:gap-6">
          <section className="space-y-5 xl:col-span-5">
            <SoftCard className="p-5">
              <p className="mb-1 text-sm font-semibold tracking-tight">Studio</p>
              <p className="mb-4 text-xs text-muted-foreground">Name and account</p>
              <OrgSettingsForm orgSlug={orgSlug} name={ctx.org.name} canWrite={ctx.canWrite} />
            </SoftCard>

            {ctx.org.modules.portal && ctx.canWrite ? (
              <SoftCard className="p-5">
                <p className="mb-1 text-sm font-semibold tracking-tight">Portal</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  Hashed share links — tokens shown once
                </p>
                <CreateShareGrantForm
                  orgSlug={orgSlug}
                  clients={clients.map((c) => ({ id: c.id, name: c.name }))}
                  partners={partners.map((p) => ({ id: p.id, name: p.name }))}
                />
                <div className="mt-4 border-t border-border/40 pt-4">
                  <ShareGrantList orgSlug={orgSlug} grants={grants} />
                </div>
              </SoftCard>
            ) : null}
          </section>

          <section className="space-y-5 xl:col-span-7" id="invoices">
            {ctx.org.modules.finance && invoiceConfig ? (
              <>
                <SoftCard className="p-5">
                  <p className="mb-1 text-sm font-semibold tracking-tight">Invoices</p>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Numbering, defaults, brand, and layout
                  </p>
                  <InvoiceSettingsForm
                    orgSlug={orgSlug}
                    orgId={ctx.org.id}
                    config={invoiceConfig}
                    logoUrl={brand?.logoUrl ?? null}
                    canWrite={ctx.canWrite}
                  />
                </SoftCard>
                <SoftCard className="p-5">
                  <p className="mb-1 text-sm font-semibold tracking-tight">Templates</p>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Presets applied when creating drafts
                  </p>
                  <InvoiceTemplatesPanel
                    orgSlug={orgSlug}
                    templates={templates}
                    canWrite={ctx.canWrite}
                  />
                </SoftCard>
              </>
            ) : (
              <SoftCard className="p-5">
                <p className="text-sm text-muted-foreground">Finance module is off.</p>
              </SoftCard>
            )}
          </section>
        </div>
      </div>
    </WorkSurface>
  );
}
