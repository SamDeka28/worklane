"use server";

import { notify, orgManagerIds } from "@/modules/notifications/service";
import { parseMajorToMinor, type IsoCurrency } from "@/shared/money";
import { createServerSupabaseClient } from "@/shared/db/supabase/server";

type IntakeResult = {
  leadId: string;
  organizationId: string;
  orgSlug: string;
  orgName: string;
  ownerUserId: string | null;
  leadName: string;
};

/** Public enquiry form submit. The RPC validates the code, rate-limits, and creates the lead. */
export async function submitLeadIntakeAction(
  code: string,
  currency: IsoCurrency,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  // Bots fill every field and submit instantly.
  if (String(formData.get("website") ?? "").trim()) return { ok: true };
  const startedAt = Number(formData.get("started_at"));
  if (Number.isFinite(startedAt) && Date.now() - startedAt < 2500) return { ok: true };

  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "This form is unavailable right now" };

  let budget: number | null = null;
  const rawBudget = String(formData.get("budget") ?? "").replace(/[^\d.]/g, "");
  if (rawBudget) {
    try {
      budget = Number(parseMajorToMinor(rawBudget, currency));
    } catch {
      budget = null;
    }
  }

  const { data, error } = await supabase.rpc("submit_lead_intake", {
    p_code: code,
    p_name: String(formData.get("name") ?? ""),
    p_email: String(formData.get("email") ?? ""),
    p_company: String(formData.get("company") ?? "") || null,
    p_phone: String(formData.get("phone") ?? "") || null,
    p_message: String(formData.get("message") ?? "") || null,
    p_budget_minor: budget,
  });
  if (error) return { error: error.message };

  const result = data as IntakeResult | null;
  if (result?.leadId) {
    const recipients = result.ownerUserId
      ? [result.ownerUserId]
      : await orgManagerIds(result.organizationId, "crm");
    await notify({
      recipients,
      organizationId: result.organizationId,
      orgName: result.orgName,
      category: "leads",
      title: `New enquiry from ${result.leadName}`,
      body: "Submitted through your enquiry form. Reply today while it’s warm.",
      href: `/${result.orgSlug}/crm?lead=${result.leadId}`,
      actorId: null,
      entity: { type: "lead", id: result.leadId },
      actionLabel: "Open lead",
      ownerCopy: false,
    });
  }
  return { ok: true };
}
