import { cache } from "react";
import type { OrgContext } from "@/modules/identity/org";
import { parseOrgInvoiceSettings } from "@/modules/invoices/settings";
import {
  pickSignature,
  renderSignature,
  signatureOnIn,
  type PersonalSignature,
  type RenderedSignature,
  type SignatureMode,
  type SignatureModule,
  type SignatureNode,
  type SignatureSender,
  type StudioSignature,
} from "@/modules/email-signatures/types";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";

type Row = {
  user_id: string | null;
  mode: SignatureMode;
  body: SignatureNode | null;
  allow_override: boolean;
  use_in_leads: boolean;
  use_in_emails: boolean;
};

/** The studio's signature and the member's own setting. Empty before the table exists. */
export async function getSignatures(
  orgId: string,
  userId: string,
): Promise<{ studio: StudioSignature | null; personal: PersonalSignature | null }> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { studio: null, personal: null };
  const { data } = await admin
    .from("email_signatures")
    .select("user_id, mode, body, allow_override, use_in_leads, use_in_emails")
    .eq("organization_id", orgId)
    .or(`user_id.is.null,user_id.eq.${userId}`);
  const rows = (data ?? []) as Row[];
  const studio = rows.find((row) => row.user_id === null);
  const personal = rows.find((row) => row.user_id === userId);
  return {
    studio: studio
      ? {
          doc: studio.body,
          allowOverride: studio.allow_override,
          useInLeads: studio.use_in_leads,
          useInEmails: studio.use_in_emails,
        }
      : null,
    personal: personal ? { mode: personal.mode, doc: personal.body } : null,
  };
}

/** The studio's business details from settings, once per request. */
const orgBusiness = cache(async (ctx: OrgContext) => {
  const { data } = await ctx.supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.org.id)
    .maybeSingle();
  return parseOrgInvoiceSettings(data?.settings).business;
});

/** The details a signature's fields are filled from. */
export async function signatureSender(ctx: OrgContext): Promise<SignatureSender> {
  const business = await orgBusiness(ctx);
  return {
    name: ctx.user.displayName?.trim() || ctx.user.email?.split("@")[0] || "",
    title: ctx.user.jobTitle,
    email: ctx.user.email,
    phone: ctx.user.phone,
    location: ctx.user.location,
    address: ctx.user.address,
    orgName: ctx.org.name,
    org: {
      legalName: business.legalName,
      email: business.email,
      phone: business.phone,
      website: business.website,
      address: business.address,
      taxId: business.taxId,
    },
  };
}

/** The signed-in member's signature for a module, and whether the studio adds signatures there. */
export async function senderSignatureState(
  ctx: OrgContext,
  module: SignatureModule,
): Promise<{ signature: RenderedSignature | null; moduleOn: boolean }> {
  const { studio, personal } = await getSignatures(ctx.org.id, ctx.userId);
  const moduleOn = signatureOnIn(studio, module);
  return {
    moduleOn,
    signature: moduleOn
      ? renderSignature(pickSignature(studio, personal), await signatureSender(ctx))
      : null,
  };
}

/** The signed-in member's signature for emails sent from a module, or null when it's off there. */
export async function senderSignature(
  ctx: OrgContext,
  module: SignatureModule,
): Promise<RenderedSignature | null> {
  return (await senderSignatureState(ctx, module)).signature;
}
