"use server";

import { revalidatePath } from "next/cache";
import { requireWritableOrg } from "@/modules/identity/org";
import {
  allocatePartnersForReceipt,
  voidPartnerAllocationsForCharge,
  voidPartnerAllocationsForPayment,
} from "@/modules/partners/allocate";
import { netFromGross, parseMajorToMinor } from "@/shared/money";
import type { IsoCurrency } from "@/shared/money";

function asCurrency(value: string, fallback: IsoCurrency): IsoCurrency {
  return value === "INR" || value === "USD" ? value : fallback;
}

export async function createChargeAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const clientId = String(formData.get("client_id") ?? "");
  const memo = String(formData.get("memo") ?? "").trim() || null;
  const chargedOn = String(formData.get("charged_on") ?? "") || new Date().toISOString().slice(0, 10);
  const dueOn = String(formData.get("due_on") ?? "").trim() || null;
  const feeBps = Number(formData.get("fee_bps") ?? 0);

  if (!clientId) return { error: "Choose a client" };
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    return { error: "Fee must be between 0 and 10000 bps" };
  }

  const { data: client, error: clientError } = await ctx.supabase
    .from("clients")
    .select("id, currency")
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (clientError || !client) {
    return { error: "Client not found" };
  }
  const currency = asCurrency(client.currency, ctx.org.defaultCurrency);

  let grossMinor: bigint;
  try {
    grossMinor = parseMajorToMinor(String(formData.get("gross") ?? ""), currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid amount" };
  }
  if (grossMinor <= BigInt(0)) {
    return { error: "Charge amount must be greater than zero" };
  }

  const netMinor = netFromGross(grossMinor, feeBps);
  const { data: charge, error } = await ctx.supabase
    .from("charges")
    .insert({
      organization_id: ctx.org.id,
      client_id: clientId,
      gross_minor: grossMinor.toString(),
      fee_bps: feeBps,
      net_minor: netMinor.toString(),
      currency,
      charged_on: chargedOn,
      due_on: dueOn,
      source: "manual",
      status: "open",
      memo,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !charge) {
    return { error: error?.message ?? "Could not create charge" };
  }

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "charged",
    entity_type: "client",
    entity_id: clientId,
    metadata: { charge_id: charge.id, gross_minor: grossMinor.toString(), fee_bps: feeBps },
  });

  revalidatePath(`/${orgSlug}`);
  return { id: charge.id as string };
}

export async function recordPaymentAction(orgSlug: string, formData: FormData) {
  const ctx = await requireWritableOrg(orgSlug);
  const clientId = String(formData.get("client_id") ?? "");
  const method = String(formData.get("method") ?? "other");
  const kind = String(formData.get("kind") ?? "receipt") === "refund" ? "refund" : "receipt";
  const paidOn = String(formData.get("paid_on") ?? "") || new Date().toISOString().slice(0, 10);
  const reference = String(formData.get("reference") ?? "").trim() || null;

  if (!clientId) return { error: "Choose a client" };
  if (!["upwork", "bank", "stripe", "other"].includes(method)) {
    return { error: "Unknown payment method" };
  }

  const { data: client } = await ctx.supabase
    .from("clients")
    .select("id, currency")
    .eq("id", clientId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!client) return { error: "Client not found" };
  const currency = asCurrency(client.currency, ctx.org.defaultCurrency);

  let amountMinor: bigint;
  try {
    amountMinor = parseMajorToMinor(String(formData.get("amount") ?? ""), currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid amount" };
  }
  if (amountMinor <= BigInt(0)) {
    return { error: "Amount must be greater than zero" };
  }

  if (kind === "refund") {
    const { data: payment, error } = await ctx.supabase
      .from("payments")
      .insert({
        organization_id: ctx.org.id,
        client_id: clientId,
        amount_minor: amountMinor.toString(),
        currency,
        paid_on: paidOn,
        method,
        reference,
        kind: "refund",
        status: "posted",
        created_by: ctx.userId,
      })
      .select("id")
      .single();

    if (error || !payment) {
      return { error: error?.message ?? "Could not record refund" };
    }

    await ctx.supabase.from("activities").insert({
      organization_id: ctx.org.id,
      actor_id: ctx.userId,
      verb: "refunded",
      entity_type: "client",
      entity_id: clientId,
      metadata: { payment_id: payment.id, amount_minor: amountMinor.toString() },
    });

    revalidatePath(`/${orgSlug}`);
    return { id: payment.id as string };
  }

  const chargeId = String(formData.get("charge_id") ?? "").trim() || null;

  const { data, error } = await ctx.supabase.rpc("post_client_receipt", {
    p_org_id: ctx.org.id,
    p_client_id: clientId,
    p_amount_minor: amountMinor.toString(),
    p_currency: currency,
    p_paid_on: paidOn,
    p_method: method,
    p_reference: reference,
    p_charge_id: chargeId,
  });

  if (error) {
    return { error: error.message };
  }

  const posted = Array.isArray(data) ? data[0] : data;
  const paymentId = posted?.payment_id as string | undefined;

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "paid",
    entity_type: "client",
    entity_id: clientId,
    metadata: {
      payment_id: paymentId,
      amount_minor: amountMinor.toString(),
      unallocated_minor: posted?.unallocated_minor ?? "0",
      charge_id: chargeId,
    },
  });

  if (paymentId) {
    const { data: allocations } = await ctx.supabase
      .from("payment_allocations")
      .select("id, charge_id, amount_minor")
      .eq("payment_id", paymentId)
      .eq("organization_id", ctx.org.id);
    try {
      await allocatePartnersForReceipt(ctx, {
        paymentId,
        allocations: (allocations ?? []).map((row) => ({
          id: row.id as string,
          chargeId: row.charge_id as string,
          amountMinor: BigInt(row.amount_minor),
        })),
      });
    } catch (allocError) {
      return {
        error:
          allocError instanceof Error
            ? allocError.message
            : "Collected, but partner earnings failed",
      };
    }
  }

  revalidatePath(`/${orgSlug}`);
  return { id: paymentId, unallocatedMinor: String(posted?.unallocated_minor ?? "0") };
}

export async function voidChargeAction(orgSlug: string, chargeId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: charge } = await ctx.supabase
    .from("charges")
    .select("id, client_id, status")
    .eq("id", chargeId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!charge) return { error: "Charge not found" };

  const { count } = await ctx.supabase
    .from("payment_allocations")
    .select("id", { count: "exact", head: true })
    .eq("charge_id", chargeId);

  if ((count ?? 0) > 0) {
    return { error: "Cancel is blocked while a receipt is applied to this charge" };
  }

  const partnerVoid = await voidPartnerAllocationsForCharge(ctx, chargeId);
  if (partnerVoid.error) return { error: partnerVoid.error };

  const { error } = await ctx.supabase
    .from("charges")
    .update({ status: "void" })
    .eq("id", chargeId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "voided",
    entity_type: "charge",
    entity_id: charge.client_id,
    metadata: { charge_id: chargeId },
  });

  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}

export async function voidPaymentAction(orgSlug: string, paymentId: string) {
  const ctx = await requireWritableOrg(orgSlug);
  const { data: payment } = await ctx.supabase
    .from("payments")
    .select("id, client_id")
    .eq("id", paymentId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!payment) return { error: "Payment not found" };

  const partnerVoid = await voidPartnerAllocationsForPayment(ctx, paymentId);
  if (partnerVoid.error) return { error: partnerVoid.error };

  const { error } = await ctx.supabase
    .from("payments")
    .update({ status: "void" })
    .eq("id", paymentId)
    .eq("organization_id", ctx.org.id);

  if (error) return { error: error.message };

  await ctx.supabase.from("activities").insert({
    organization_id: ctx.org.id,
    actor_id: ctx.userId,
    verb: "voided",
    entity_type: "payment",
    entity_id: payment.client_id,
    metadata: { payment_id: paymentId },
  });

  revalidatePath(`/${orgSlug}`);
  return { ok: true as const };
}
