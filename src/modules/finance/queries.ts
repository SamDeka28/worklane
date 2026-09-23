import { cache } from "react";
import { listClients, listOrgActivity } from "@/modules/clients/queries";
import { countProjects } from "@/modules/delivery/queries";
import { requireOrg } from "@/modules/identity/org";
import {
  asLedgerMinor,
  clientMoneySnapshot,
  statementForMonth,
  withChargeOutstanding,
  type AllocationRow,
  type ChargeRow,
  type PaymentRow,
} from "@/modules/finance/ledger";
import type { IsoCurrency } from "@/shared/money";

function mapCharge(row: {
  id: string;
  client_id: string;
  project_id?: string | null;
  milestone_id?: string | null;
  work_log_id?: string | null;
  gross_minor: string | number;
  fee_bps: number;
  net_minor: string | number;
  currency: string;
  charged_on: string;
  due_on: string | null;
  source: string;
  status: string;
  memo: string | null;
  created_at: string;
}): ChargeRow {
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id ?? null,
    milestoneId: row.milestone_id ?? null,
    workLogId: row.work_log_id ?? null,
    grossMinor: asLedgerMinor(row.gross_minor),
    feeBps: row.fee_bps,
    netMinor: asLedgerMinor(row.net_minor),
    currency: row.currency === "INR" ? "INR" : "USD",
    chargedOn: row.charged_on,
    dueOn: row.due_on,
    source: row.source,
    status: row.status === "void" ? "void" : "open",
    memo: row.memo,
    createdAt: row.created_at,
  };
}

function mapPayment(row: {
  id: string;
  client_id: string;
  amount_minor: string | number;
  currency: string;
  paid_on: string;
  method: string;
  reference: string | null;
  kind: string;
  status: string;
  created_at: string;
}): PaymentRow {
  return {
    id: row.id,
    clientId: row.client_id,
    amountMinor: asLedgerMinor(row.amount_minor),
    currency: row.currency === "INR" ? "INR" : "USD",
    paidOn: row.paid_on,
    method: row.method,
    reference: row.reference,
    kind: row.kind === "refund" ? "refund" : "receipt",
    status: row.status === "void" ? "void" : "posted",
    createdAt: row.created_at,
  };
}

/** One org ledger load per request (statements reuse this). */
const loadLedger = cache(async (orgSlug: string, clientId = "") => {
  const { org, supabase } = await requireOrg(orgSlug);
  const scopedClient = clientId || undefined;

  let chargesQuery = supabase
    .from("charges")
    .select(
      "id, client_id, project_id, milestone_id, work_log_id, gross_minor, fee_bps, net_minor, currency, charged_on, due_on, source, status, memo, created_at",
    )
    .eq("organization_id", org.id)
    .order("charged_on", { ascending: false });

  let paymentsQuery = supabase
    .from("payments")
    .select(
      "id, client_id, amount_minor, currency, paid_on, method, reference, kind, status, created_at",
    )
    .eq("organization_id", org.id)
    .order("paid_on", { ascending: false });

  if (scopedClient) {
    chargesQuery = chargesQuery.eq("client_id", scopedClient);
    paymentsQuery = paymentsQuery.eq("client_id", scopedClient);
  }

  const [chargesRes, paymentsRes, allocationsRes] = await Promise.all([
    chargesQuery,
    paymentsQuery,
    supabase
      .from("payment_allocations")
      .select("payment_id, charge_id, amount_minor")
      .eq("organization_id", org.id),
  ]);

  if (chargesRes.error) throw new Error(chargesRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);
  if (allocationsRes.error) throw new Error(allocationsRes.error.message);

  const charges = (chargesRes.data ?? []).map(mapCharge);
  const payments = (paymentsRes.data ?? []).map(mapPayment);
  const allocations: AllocationRow[] = (allocationsRes.data ?? []).map((row) => ({
    paymentId: row.payment_id,
    chargeId: row.charge_id,
    amountMinor: asLedgerMinor(row.amount_minor),
  }));

  return { org, charges, payments, allocations };
});

export const loadOrgFinance = cache(async (orgSlug: string) => {
  const { org, charges, payments, allocations } = await loadLedger(orgSlug);
  const views = withChargeOutstanding(charges, allocations, payments);
  const snapshot = clientMoneySnapshot(charges, payments, allocations);
  return { org, charges: views, payments, snapshot, allocations };
});

export async function loadClientFinance(orgSlug: string, clientId: string) {
  const { org, charges, payments, allocations } = await loadLedger(orgSlug, clientId);
  const views = withChargeOutstanding(charges, allocations, payments);
  const snapshot = clientMoneySnapshot(charges, payments, allocations);
  return { org, charges: views, payments, snapshot, allocations };
}

export async function loadProjectFinance(orgSlug: string, projectId: string) {
  const { org, supabase } = await requireOrg(orgSlug);

  const { data: chargeRows, error: chargesError } = await supabase
    .from("charges")
    .select(
      "id, client_id, project_id, milestone_id, work_log_id, gross_minor, fee_bps, net_minor, currency, charged_on, due_on, source, status, memo, created_at",
    )
    .eq("organization_id", org.id)
    .eq("project_id", projectId)
    .order("charged_on", { ascending: false });
  if (chargesError) throw new Error(chargesError.message);

  const charges = (chargeRows ?? []).map(mapCharge);
  const chargeIds = charges.map((row) => row.id);

  if (chargeIds.length === 0) {
    return {
      charges: withChargeOutstanding([], [], []),
      snapshot: clientMoneySnapshot([], [], []),
    };
  }

  const { data: allocationRows, error: allocationsError } = await supabase
    .from("payment_allocations")
    .select("payment_id, charge_id, amount_minor")
    .eq("organization_id", org.id)
    .in("charge_id", chargeIds);
  if (allocationsError) throw new Error(allocationsError.message);

  const allocations: AllocationRow[] = (allocationRows ?? []).map((row) => ({
    paymentId: row.payment_id,
    chargeId: row.charge_id,
    amountMinor: asLedgerMinor(row.amount_minor),
  }));

  const paymentIds = [...new Set(allocations.map((row) => row.paymentId))];
  let payments: PaymentRow[] = [];
  if (paymentIds.length > 0) {
    const { data: paymentRows, error: paymentsError } = await supabase
      .from("payments")
      .select(
        "id, client_id, amount_minor, currency, paid_on, method, reference, kind, status, created_at",
      )
      .eq("organization_id", org.id)
      .in("id", paymentIds);
    if (paymentsError) throw new Error(paymentsError.message);
    payments = (paymentRows ?? []).map(mapPayment);
  }

  const views = withChargeOutstanding(charges, allocations, payments);
  const snapshot = clientMoneySnapshot(charges, payments, allocations);
  return { charges: views, snapshot };
}

export async function loadMonthlyStatement(
  orgSlug: string,
  yearMonth: string,
  clientId?: string,
) {
  const { charges, payments } = await loadLedger(orgSlug, clientId ?? "");
  const currency: IsoCurrency = charges[0]?.currency ?? payments[0]?.currency ?? "USD";
  return {
    currency,
    ...statementForMonth(charges, payments, yearMonth),
  };
}

/** Multiple months from one cached ledger (avoids N statement round-trips). */
export async function loadMonthlyStatements(
  orgSlug: string,
  yearMonths: string[],
  clientId?: string,
) {
  const { charges, payments } = await loadLedger(orgSlug, clientId ?? "");
  const currency: IsoCurrency = charges[0]?.currency ?? payments[0]?.currency ?? "USD";
  return yearMonths.map((yearMonth) => ({
    yearMonth,
    currency,
    ...statementForMonth(charges, payments, yearMonth),
  }));
}

export const loadOrgDashboard = cache(async (orgSlug: string) => {
  const [finance, clients, activities, projectCount] = await Promise.all([
    loadOrgFinance(orgSlug),
    listClients(orgSlug),
    listOrgActivity(orgSlug, 30),
    countProjects(orgSlug),
  ]);

  const names = new Map(clients.map((client) => [client.id, client.name]));
  const openCharges = finance.charges.filter(
    (charge) => charge.status === "open" && charge.outstandingMinor > BigInt(0),
  );

  return {
    currency: finance.snapshot.currency,
    outstandingMinor: finance.snapshot.outstandingMinor,
    overdueMinor: finance.snapshot.overdueMinor,
    billedMinor: finance.snapshot.billedMinor,
    collectedMinor: finance.snapshot.collectedMinor,
    clientCount: clients.length,
    projectCount,
    openChargeCount: openCharges.length,
    paymentCount: finance.payments.filter((row) => row.status === "posted").length,
    recentClients: [...clients]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6),
    activities: activities.map((row) => ({
      ...row,
      clientName: row.entityId ? (names.get(row.entityId) ?? null) : null,
    })),
  };
});

export async function listClientsWithOutstanding(orgSlug: string, query?: string) {
  const clients = await listClients(orgSlug, query);
  const { charges, payments, allocations } = await loadLedger(orgSlug);
  return clients.map((client) => {
    const snapshot = clientMoneySnapshot(
      charges.filter((row) => row.clientId === client.id),
      payments.filter((row) => row.clientId === client.id),
      allocations,
    );
    return { client, snapshot };
  });
}
