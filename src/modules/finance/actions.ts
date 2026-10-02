"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/modules/identity/org";
import { notify, orgManagerIds } from "@/modules/notifications/service";
import { asIsoCurrency, formatMoney, parseMajorToMinor } from "@/shared/money";
import { createChargeRecord, isWriteError, recordPaymentRecord, voidChargeRecord, voidPaymentRecord } from "@/modules/records/mutate";

export async function createChargeAction(orgSlug: string, formData: FormData) {
  const ctx = await requireModuleWrite(orgSlug, "finance");
  const clientId = String(formData.get("client_id") ?? "");
  const memo = String(formData.get("memo") ?? "").trim() || null;
  const chargedOn = String(formData.get("charged_on") ?? "") || new Date().toISOString().slice(0, 10);
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  const feeBps = Number(formData.get("fee_bps") ?? 0);

  const created = await createChargeRecord(ctx, {
    clientId,
    gross: String(formData.get("gross") ?? ""),
    memo: memo ?? undefined,
    chargedOn,
    dueOn: dueOn ?? undefined,
    feeBps,
  });
  if (isWriteError(created)) return { error: created.error };

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/finance`);
  revalidatePath(`/${orgSlug}/clients/${clientId}`);
  return { id: created.id as string };
}

export async function recordPaymentAction(orgSlug: string, formData: FormData) {
  const ctx = await requireModuleWrite(orgSlug, "finance");
  const clientId = String(formData.get("client_id") ?? "");
  const method = String(formData.get("method") ?? "other");
  const kind = String(formData.get("kind") ?? "receipt") === "refund" ? "refund" : "receipt";
  const paidOn = String(formData.get("paid_on") ?? "") || new Date().toISOString().slice(0, 10);
  const reference = String(formData.get("reference") ?? "").trim() || null;

  const chargeId = String(formData.get("charge_id") ?? "").trim() || undefined;
  const posted = await recordPaymentRecord(ctx, {
    clientId,
    amount: String(formData.get("amount") ?? ""),
    paidOn,
    method,
    reference: reference ?? undefined,
    kind,
    chargeId,
  });
  if (isWriteError(posted)) return { error: posted.error };

  if (kind === "receipt") {
    const { data: client } = await ctx.supabase
      .from("clients")
      .select("name, currency")
      .eq("id", clientId)
      .eq("organization_id", ctx.org.id)
      .maybeSingle();
    const currency = asIsoCurrency(String(client?.currency ?? ctx.org.defaultCurrency), ctx.org.defaultCurrency);
    let amountMinor = BigInt(0);
    try {
      amountMinor = parseMajorToMinor(String(formData.get("amount") ?? ""), currency);
    } catch {
      amountMinor = BigInt(0);
    }
    await notify({
      recipients: await orgManagerIds(ctx.org.id, "finance"),
      organizationId: ctx.org.id,
      orgName: ctx.org.name,
      category: "finance",
      title: `Payment received from ${(client?.name as string | undefined) ?? "a client"}`,
      body: `${formatMoney({ amountMinor, currency })} via ${method} on ${paidOn}${reference ? ` · ${reference}` : ""}.`,
      href: `/${orgSlug}/clients/${clientId}`,
      actorId: ctx.userId,
      entity: { type: "payment", id: String(posted.id ?? clientId) },
      actionLabel: "View client",
    });
  }

  revalidatePath(`/${orgSlug}`);
  return { id: posted.id as string | undefined, unallocatedMinor: String(posted.unallocatedMinor ?? "0") };
}

export async function voidChargeAction(orgSlug: string, chargeId: string) {
  const ctx = await requireModuleWrite(orgSlug, "finance");
  const voided = await voidChargeRecord(ctx, chargeId);
  if (isWriteError(voided)) return { error: voided.error };
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

export async function voidPaymentAction(orgSlug: string, paymentId: string) {
  const ctx = await requireModuleWrite(orgSlug, "finance");
  const voided = await voidPaymentRecord(ctx, paymentId);
  if (isWriteError(voided)) return { error: voided.error };
  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}
