import type { SupabaseClient } from "@supabase/supabase-js";
import { BILLING_MODE_LABEL } from "@/modules/delivery/board";
import { mapOrganization, requireOrgForClient, type OrgContext } from "@/modules/identity/org";
import { canAccessModule, canSeeMoney } from "@/modules/identity/permissions";
import type { OrgRole, Organization } from "@/modules/identity/types";
import { invoiceSubtotalMinor } from "@/modules/invoices/totals";
import { asIsoCurrency, formatMoney, type IsoCurrency } from "@/shared/money";

const READ_ONLY =
  "Read-only. This cannot create, change, send, or delete anything in Worklane.";

type Reader = { supabase: SupabaseClient; userId: string };

type Studio = { org: Organization; role: OrgRole };

function money(amountMinor: bigint, currency: IsoCurrency) {
  return formatMoney({ amountMinor, currency });
}

export async function listMemberStudios(reader: Reader): Promise<Studio[]> {
  const { data, error } = await reader.supabase
    .from("organization_members")
    .select("role, organizations ( id, slug, name, default_currency, timezone, settings )")
    .eq("user_id", reader.userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => {
      const orgRow = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      if (!orgRow) return null;
      return { org: mapOrganization(orgRow), role: row.role as OrgRole };
    })
    .filter((row): row is Studio => Boolean(row));
}

export async function studioFor(reader: Reader, slug: string | undefined): Promise<OrgContext | { error: string }> {
  const studios = await listMemberStudios(reader);
  if (studios.length === 0) return { error: "This account isn't a member of a studio yet." };
  const chosen = slug?.trim() || (studios.length === 1 ? studios[0].org.slug : "");
  if (!chosen) {
    return {
      error: `Pass org with one of: ${studios.map((studio) => studio.org.slug).join(", ")}.`,
    };
  }
  const ctx = await requireOrgForClient(reader.supabase, reader.userId, chosen);
  if (!ctx) return { error: "You don't have access to that studio." };
  return ctx;
}

function denied(module: string) {
  return { error: `You don't have access to ${module} in this studio.` };
}

export async function readStudios(reader: Reader) {
  const studios = await listMemberStudios(reader);
  return studios.map((studio) => ({
    slug: studio.org.slug,
    name: studio.org.name,
    role: studio.role,
    currency: studio.org.defaultCurrency,
  }));
}

export async function readClients(reader: Reader, input: { org?: string; query?: string }) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  let builder = ctx.supabase
    .from("clients")
    .select("id, name, kind, currency")
    .eq("organization_id", ctx.org.id)
    .is("archived_at", null)
    .order("name")
    .limit(50);
  const query = input.query?.trim();
  if (query) builder = builder.ilike("name", `%${query.replace(/[%_]/g, "")}%`);
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((row) => row.id as string);
  const contacts = await primaryContacts(ctx, ids);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as string,
    currency: asIsoCurrency(row.currency as string),
    primaryContact: contacts.get(row.id as string) ?? null,
  }));
}

export async function readClient(reader: Reader, input: { org?: string; id: string }) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  const { data, error } = await ctx.supabase
    .from("clients")
    .select("id, name, kind, currency, archived_at")
    .eq("organization_id", ctx.org.id)
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.archived_at) return { error: "Client not found." };
  const contacts = await primaryContacts(ctx, [data.id as string]);
  return {
    id: data.id as string,
    name: data.name as string,
    kind: data.kind as string,
    currency: asIsoCurrency(data.currency as string),
    primaryContact: contacts.get(data.id as string) ?? null,
  };
}

async function primaryContacts(ctx: OrgContext, clientIds: string[]) {
  const map = new Map<string, { name: string | null; email: string | null }>();
  if (clientIds.length === 0) return map;
  const { data, error } = await ctx.supabase
    .from("contacts")
    .select("client_id, name, email, is_primary")
    .eq("organization_id", ctx.org.id)
    .in("client_id", clientIds)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const id = row.client_id as string;
    if (!map.has(id)) {
      map.set(id, { name: (row.name as string | null) ?? null, email: (row.email as string | null) ?? null });
    }
  }
  return map;
}

const PROJECT_SELECT =
  "id, name, status, billing_mode, client_id, contracted_amount_minor, hourly_rate_minor, clients(name, currency)";

export async function readProjects(reader: Reader, input: { org?: string }) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  if (!ctx.org.modules.delivery || !canAccessModule(ctx.permissions, "delivery")) return denied("projects");
  const { data, error } = await ctx.supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("organization_id", ctx.org.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const seeMoney = canSeeMoney(ctx.permissions);
  return (data ?? []).map((row) => projectJson(row, seeMoney));
}

export async function readProject(reader: Reader, input: { org?: string; id: string }) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  if (!ctx.org.modules.delivery || !canAccessModule(ctx.permissions, "delivery")) return denied("projects");
  const { data, error } = await ctx.supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("organization_id", ctx.org.id)
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { error: "Project not found." };
  return projectJson(data, canSeeMoney(ctx.permissions));
}

function projectJson(
  row: {
    id: string;
    name: string;
    status: string;
    billing_mode: string;
    client_id: string;
    contracted_amount_minor: string | number | null;
    hourly_rate_minor: string | number | null;
    clients: { name: string; currency: string } | { name: string; currency: string }[] | null;
  },
  seeMoney: boolean,
) {
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const currency = asIsoCurrency(client?.currency);
  const mode = row.billing_mode in BILLING_MODE_LABEL
    ? BILLING_MODE_LABEL[row.billing_mode as keyof typeof BILLING_MODE_LABEL]
    : row.billing_mode;
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    billingMode: mode,
    client: client ? { id: row.client_id, name: client.name } : null,
    ...(seeMoney
      ? {
          contractedAmount:
            row.contracted_amount_minor == null
              ? null
              : money(BigInt(row.contracted_amount_minor), currency),
          hourlyRate:
            row.hourly_rate_minor == null ? null : money(BigInt(row.hourly_rate_minor), currency),
        }
      : {}),
  };
}

export async function readInvoices(reader: Reader, input: { org?: string }) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  if (!ctx.org.modules.finance || !canSeeMoney(ctx.permissions)) return denied("invoices");
  const { data, error } = await ctx.supabase
    .from("invoices")
    .select("id, number, status, currency, due_on, client_id, clients(name)")
    .eq("organization_id", ctx.org.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const amounts = await invoiceAmounts(ctx, rows.map((row) => row.id as string));
  return rows.map((row) => invoiceJson(row, amounts.get(row.id as string)));
}

export async function readInvoice(reader: Reader, input: { org?: string; id: string }) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  if (!ctx.org.modules.finance || !canSeeMoney(ctx.permissions)) return denied("invoices");
  const { data, error } = await ctx.supabase
    .from("invoices")
    .select("id, number, status, currency, due_on, client_id, clients(name)")
    .eq("organization_id", ctx.org.id)
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { error: "Invoice not found." };
  const amounts = await invoiceAmounts(ctx, [data.id as string]);
  return invoiceJson(data, amounts.get(data.id as string));
}

async function invoiceAmounts(ctx: OrgContext, invoiceIds: string[]) {
  const totals = new Map<string, { total: bigint; paid: bigint }>();
  if (invoiceIds.length === 0) return totals;
  const { data: lines, error } = await ctx.supabase
    .from("invoice_lines")
    .select("invoice_id, quantity, unit_amount_minor, tax_bps, discount_minor, charge_id")
    .eq("organization_id", ctx.org.id)
    .in("invoice_id", invoiceIds);
  if (error) throw new Error(error.message);
  const byInvoice = new Map<string, typeof lines>();
  const chargeToInvoice = new Map<string, string>();
  for (const line of lines ?? []) {
    const id = line.invoice_id as string;
    const list = byInvoice.get(id) ?? [];
    list.push(line);
    byInvoice.set(id, list);
    if (line.charge_id) chargeToInvoice.set(line.charge_id as string, id);
  }
  const paid = new Map<string, bigint>();
  if (chargeToInvoice.size > 0) {
    const { data: allocations, error: paidError } = await ctx.supabase
      .from("payment_allocations")
      .select("charge_id, amount_minor, payment:payments(status, kind)")
      .eq("organization_id", ctx.org.id)
      .in("charge_id", [...chargeToInvoice.keys()]);
    if (paidError) throw new Error(paidError.message);
    for (const row of allocations ?? []) {
      const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment;
      if (!payment || payment.kind !== "receipt" || payment.status === "void") continue;
      const invoiceId = chargeToInvoice.get(row.charge_id as string);
      if (!invoiceId) continue;
      paid.set(invoiceId, (paid.get(invoiceId) ?? BigInt(0)) + BigInt(row.amount_minor as string | number));
    }
  }
  for (const id of invoiceIds) {
    const total = invoiceSubtotalMinor(
      (byInvoice.get(id) ?? []).map((line) => ({
        quantity: Number(line.quantity),
        unitAmountMinor: BigInt(line.unit_amount_minor as string | number),
        taxBps: Number(line.tax_bps),
        discountMinor: BigInt(line.discount_minor as string | number),
      })),
    );
  totals.set(id, { total, paid: paid.get(id) ?? BigInt(0) });
  }
  return totals;
}

function invoiceJson(
  row: {
    id: string;
    number: string;
    status: string;
    currency: string;
    due_on: string | null;
    client_id: string;
    clients: { name: string } | { name: string }[] | null;
  },
  amounts: { total: bigint; paid: bigint } | undefined,
) {
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const currency = asIsoCurrency(row.currency);
  const total = amounts?.total ?? BigInt(0);
  const paid = amounts?.paid ?? BigInt(0);
  const balance = total > paid ? total - paid : BigInt(0);
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    dueOn: row.due_on,
    client: client ? { id: row.client_id, name: client.name } : null,
    total: money(total, currency),
    balance: money(balance, currency),
  };
}

const LEAD_SELECT = "id, name, company, stage, currency, estimated_value_minor";

export async function readLeads(reader: Reader, input: { org?: string; query?: string }) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  if (!ctx.org.modules.crm || !canAccessModule(ctx.permissions, "crm")) return denied("leads");
  let builder = ctx.supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("organization_id", ctx.org.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  const query = input.query?.trim();
  if (query) {
    const pattern = `%${query.replace(/[%_,()]/g, " ")}%`;
    builder = builder.or(`name.ilike.${pattern},company.ilike.${pattern}`);
  }
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return (data ?? []).map(leadJson);
}

export async function readLead(reader: Reader, input: { org?: string; id: string }) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  if (!ctx.org.modules.crm || !canAccessModule(ctx.permissions, "crm")) return denied("leads");
  const { data, error } = await ctx.supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("organization_id", ctx.org.id)
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { error: "Lead not found." };
  return leadJson(data);
}

function leadJson(row: {
  id: string;
  name: string;
  company: string | null;
  stage: string;
  currency: string;
  estimated_value_minor: string | number | null;
}) {
  const currency = asIsoCurrency(row.currency);
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    stage: row.stage,
    estimatedValue:
      row.estimated_value_minor == null ? null : money(BigInt(row.estimated_value_minor), currency),
  };
}

export const TOOL_NOTE = READ_ONLY;
