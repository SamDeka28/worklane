import { cache } from "react";
import { requireOrg } from "@/modules/identity/org";
import {
  parseOrgInvoiceSettings,
  type InvoiceBrand,
  type InvoiceBrandSnapshot,
  type OrgInvoiceSettings,
  parseBrandSnapshot,
} from "@/modules/invoices/settings";

export type OrgInvoiceConfig = OrgInvoiceSettings & {
  nextNumber: number;
};

export const loadOrgInvoiceConfig = cache(async (orgSlug: string): Promise<OrgInvoiceConfig> => {
  const ctx = await requireOrg(orgSlug);
  const { data, error } = await ctx.supabase
    .from("organizations")
    .select("settings, invoice_next_number")
    .eq("id", ctx.org.id)
    .single();
  if (error) throw new Error(error.message);

  const settings = parseOrgInvoiceSettings(data?.settings);
  return {
    ...settings,
    nextNumber: Number(data?.invoice_next_number ?? 1) || 1,
  };
});

export async function resolveInvoiceBrand(
  orgSlug: string,
  snapshot?: unknown,
): Promise<InvoiceBrand> {
  const ctx = await requireOrg(orgSlug);
  const snap = parseBrandSnapshot(snapshot);
  if (snap) {
    let logoUrl: string | null = null;
    if (snap.logoFileId) {
      logoUrl = await signedLogoUrl(orgSlug, snap.logoFileId);
    }
    return {
      accentHex: snap.accentHex,
      logoFileId: snap.logoFileId,
      logoUrl,
      showBusinessDetails: snap.showBusinessDetails,
      layout: snap.layout,
      orgName: snap.orgName,
      business: snap.business,
    };
  }

  const config = await loadOrgInvoiceConfig(orgSlug);
  let logoUrl: string | null = null;
  if (config.brand.logoFileId) {
    logoUrl = await signedLogoUrl(orgSlug, config.brand.logoFileId);
  }
  return {
    accentHex: config.brand.accentHex,
    logoFileId: config.brand.logoFileId,
    logoUrl,
    showBusinessDetails: config.brand.showBusinessDetails,
    layout: config.brand.layout,
    orgName: ctx.org.name,
    business: config.business,
  };
}

export function brandToSnapshot(brand: InvoiceBrand): InvoiceBrandSnapshot {
  return {
    layout: brand.layout,
    accentHex: brand.accentHex,
    logoFileId: brand.logoFileId,
    orgName: brand.orgName,
    showBusinessDetails: brand.showBusinessDetails,
    business: brand.business,
  };
}

const signedLogoUrl = cache(async (orgSlug: string, fileId: string): Promise<string | null> => {
  const { supabase, org } = await requireOrg(orgSlug);
  const { data } = await supabase
    .from("files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("organization_id", org.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data?.storage_path) return null;
  const { data: signed } = await supabase.storage
    .from("org-files")
    .createSignedUrl(data.storage_path, 60 * 60);
  return signed?.signedUrl ?? null;
});
