import {
  asLedgerMinor,
  clientMoneySnapshot,
  type AllocationRow,
  type ChargeRow,
  type PaymentRow,
} from "@/modules/finance/ledger";
import type { OrgContext } from "@/modules/identity/org";
import { canAccessModule, canSeeMoney } from "@/modules/identity/permissions";
import { asIsoCurrency, formatMoney, type IsoCurrency } from "@/shared/money";

type Item = {
  kind: string;
  id: string;
  title: string;
  why: string;
  clientId?: string | null;
  projectId?: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(amountMinor: bigint, currency: IsoCurrency) {
  return formatMoney({ amountMinor, currency });
}

function moduleOpen(ctx: OrgContext, key: "delivery" | "finance" | "crm" | "documents") {
  return Boolean(ctx.org.modules[key]) && canAccessModule(ctx.permissions, key);
}

async function snapshots(ctx: OrgContext, scope: { clientId?: string | null; projectId?: string | null }) {
  if (!moduleOpen(ctx, "finance") || !canSeeMoney(ctx.permissions)) return null;
  let chargesQuery = ctx.supabase
    .from("charges")
    .select("id, client_id, project_id, gross_minor, net_minor, fee_bps, currency, charged_on, due_on, source, status, memo, created_at")
    .eq("organization_id", ctx.org.id)
    .limit(2000);
  let paymentsQuery = ctx.supabase
    .from("payments")
    .select("id, client_id, amount_minor, currency, paid_on, method, reference, kind, status, created_at")
    .eq("organization_id", ctx.org.id)
    .limit(2000);
  if (scope.clientId) {
    chargesQuery = chargesQuery.eq("client_id", scope.clientId);
    paymentsQuery = paymentsQuery.eq("client_id", scope.clientId);
  }
  if (scope.projectId) chargesQuery = chargesQuery.eq("project_id", scope.projectId);
  const [chargesResult, paymentsResult, allocationsResult] = await Promise.all([
    chargesQuery,
    paymentsQuery,
    ctx.supabase.from("payment_allocations").select("payment_id, charge_id, amount_minor").eq("organization_id", ctx.org.id).limit(4000),
  ]);
  if (chargesResult.error) return { error: chargesResult.error.message };
  if (paymentsResult.error) return { error: paymentsResult.error.message };
  const charges: ChargeRow[] = (chargesResult.data ?? []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id,
    milestoneId: null,
    workLogId: null,
    grossMinor: asLedgerMinor(row.gross_minor),
    feeBps: row.fee_bps ?? 0,
    netMinor: asLedgerMinor(row.net_minor),
    currency: asIsoCurrency(row.currency),
    chargedOn: row.charged_on,
    dueOn: row.due_on,
    source: row.source,
    status: row.status === "void" ? "void" : "open",
    memo: row.memo,
    createdAt: row.created_at,
  }));
  const payments: PaymentRow[] = (paymentsResult.data ?? []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    amountMinor: asLedgerMinor(row.amount_minor),
    currency: asIsoCurrency(row.currency),
    paidOn: row.paid_on,
    method: row.method,
    reference: row.reference,
    kind: row.kind === "refund" ? "refund" : "receipt",
    status: row.status === "void" ? "void" : "posted",
    createdAt: row.created_at,
  }));
  const allocations: AllocationRow[] = (allocationsResult.data ?? []).map((row) => ({
    paymentId: row.payment_id,
    chargeId: row.charge_id,
    amountMinor: asLedgerMinor(row.amount_minor),
  }));
  const currencies = [...new Set([...charges.map((row) => row.currency), ...payments.map((row) => row.currency)])];
  const byCurrency = (currencies.length ? currencies : [ctx.org.defaultCurrency]).map((currency) => {
    const snapshot = clientMoneySnapshot(
      charges.filter((row) => row.currency === currency),
      payments.filter((row) => row.currency === currency),
      allocations,
    );
    return {
      currency,
      billed: money(snapshot.billedMinor, currency),
      collected: money(snapshot.collectedMinor, currency),
      outstanding: money(snapshot.outstandingMinor, currency),
      overdue: money(snapshot.overdueMinor, currency),
    };
  });
  return { byCurrency };
}

async function contracted(ctx: OrgContext, scope: { clientId?: string | null; projectId?: string | null }) {
  if (!moduleOpen(ctx, "delivery") || !canSeeMoney(ctx.permissions)) return [];
  let query = ctx.supabase
    .from("projects")
    .select("id, contracted_amount_minor, clients(currency)")
    .eq("organization_id", ctx.org.id)
    .neq("status", "cancelled")
    .limit(500);
  if (scope.clientId) query = query.eq("client_id", scope.clientId);
  if (scope.projectId) query = query.eq("id", scope.projectId);
  const { data } = await query;
  const totals = new Map<IsoCurrency, bigint>();
  for (const row of data ?? []) {
    if (row.contracted_amount_minor == null) continue;
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const currency = asIsoCurrency(client?.currency);
    totals.set(currency, (totals.get(currency) ?? BigInt(0)) + asLedgerMinor(row.contracted_amount_minor));
  }
  return [...totals.entries()].map(([currency, amountMinor]) => ({
    currency,
    contracted: money(amountMinor, currency),
  }));
}

export async function attentionFor(ctx: OrgContext): Promise<Item[]> {
  const day = today();
  const items: Item[] = [];
  if (moduleOpen(ctx, "finance") && canSeeMoney(ctx.permissions)) {
    const { data } = await ctx.supabase
      .from("charges")
      .select("id, client_id, project_id, memo, due_on, currency, gross_minor")
      .eq("organization_id", ctx.org.id)
      .eq("status", "open")
      .lt("due_on", day)
      .order("due_on", { ascending: true })
      .limit(8);
    for (const row of data ?? []) {
      const currency = asIsoCurrency(row.currency);
      items.push({
        kind: "invoice_overdue",
        id: row.id,
        title: row.memo || "Open charge",
        why: `Due ${row.due_on} · ${money(asLedgerMinor(row.gross_minor), currency)}`,
        clientId: row.client_id,
        projectId: row.project_id,
      });
    }
  }
  if (moduleOpen(ctx, "crm")) {
    const { data } = await ctx.supabase
      .from("leads")
      .select("id, name, company, next_action, next_action_on")
      .eq("organization_id", ctx.org.id)
      .is("closed_at", null)
      .not("next_action_on", "is", null)
      .lte("next_action_on", day)
      .order("next_action_on", { ascending: true })
      .limit(8);
    for (const row of data ?? []) {
      items.push({
        kind: row.next_action_on < day ? "lead_overdue" : "lead_due",
        id: row.id,
        title: row.company && row.company !== row.name ? `${row.name} · ${row.company}` : row.name,
        why: `${row.next_action || "Follow up"} · ${row.next_action_on}`,
      });
    }
  }
  if (moduleOpen(ctx, "delivery")) {
    const { data } = await ctx.supabase
      .from("tasks")
      .select("id, title, project_id, due_on")
      .eq("organization_id", ctx.org.id)
      .neq("status", "done")
      .lt("due_on", day)
      .order("due_on", { ascending: true })
      .limit(8);
    for (const row of data ?? []) {
      items.push({
        kind: "task_overdue",
        id: row.id,
        title: row.title,
        why: `Due ${row.due_on}`,
        projectId: row.project_id,
      });
    }
    const { data: milestones } = await ctx.supabase
      .from("milestones")
      .select("id, name, project_id, due_on")
      .eq("organization_id", ctx.org.id)
      .in("status", ["planned", "in_progress"])
      .lt("due_on", day)
      .order("due_on", { ascending: true })
      .limit(6);
    for (const row of milestones ?? []) {
      items.push({
        kind: "milestone_overdue",
        id: row.id,
        title: row.name,
        why: `Due ${row.due_on}`,
        projectId: row.project_id,
      });
    }
  }
  if (moduleOpen(ctx, "documents")) {
    const { data } = await ctx.supabase
      .from("documents")
      .select("id, title, client_id, project_id, updated_at")
      .eq("organization_id", ctx.org.id)
      .eq("status", "sent")
      .order("updated_at", { ascending: true })
      .limit(6);
    for (const row of data ?? []) {
      items.push({
        kind: "document_sent",
        id: row.id,
        title: row.title,
        why: "Sent and not yet signed",
        clientId: row.client_id,
        projectId: row.project_id,
      });
    }
  }
  return items.slice(0, 24);
}

export async function studioHealth(ctx: OrgContext) {
  const [{ count: activeProjects }, { count: openLeads }, finance, agreements, attention] = await Promise.all([
    moduleOpen(ctx, "delivery")
      ? ctx.supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).in("status", ["planning", "active"])
      : Promise.resolve({ count: null }),
    moduleOpen(ctx, "crm")
      ? ctx.supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", ctx.org.id).is("closed_at", null)
      : Promise.resolve({ count: null }),
    snapshots(ctx, {}),
    contracted(ctx, {}),
    attentionFor(ctx),
  ]);
  return {
    studio: ctx.org.name,
    activeProjects: activeProjects ?? null,
    openLeads: openLeads ?? null,
    finance: finance && "byCurrency" in finance ? finance.byCurrency : null,
    contracted: agreements,
    attention: attention.slice(0, 5),
  };
}

export async function projectHealth(ctx: OrgContext, projectId: string) {
  if (!moduleOpen(ctx, "delivery")) return { error: "You don't have access to projects in this studio." };
  const { data: project } = await ctx.supabase
    .from("projects")
    .select("id, name, status, client_id, due_on, billing_mode, clients(name, currency)")
    .eq("organization_id", ctx.org.id)
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found" };
  const client = Array.isArray(project.clients) ? project.clients[0] : project.clients;
  const day = today();
  const [tasks, milestones, hours, documents, finance] = await Promise.all([
    ctx.supabase.from("tasks").select("id, status, due_on").eq("organization_id", ctx.org.id).eq("project_id", projectId),
    ctx.supabase.from("milestones").select("id, name, status, due_on").eq("organization_id", ctx.org.id).eq("project_id", projectId).limit(12),
    ctx.supabase.from("work_logs").select("hours_millis").eq("organization_id", ctx.org.id).eq("project_id", projectId).limit(2000),
    moduleOpen(ctx, "documents")
      ? ctx.supabase
          .from("documents")
          .select("id, title, status")
          .eq("organization_id", ctx.org.id)
          .or(
            project.client_id
              ? `project_id.eq.${projectId},and(client_id.eq.${project.client_id},project_id.is.null)`
              : `project_id.eq.${projectId}`,
          )
          .limit(8)
      : Promise.resolve({ data: [] }),
    snapshots(ctx, { projectId }),
  ]);
  const taskRows = tasks.data ?? [];
  const openTasks = taskRows.filter((row) => row.status !== "done");
  const overdueTasks = openTasks.filter((row) => row.due_on && row.due_on < day);
  const hoursMillis = (hours.data ?? []).reduce((sum, row) => sum + Number(row.hours_millis ?? 0), 0);
  const next = overdueTasks[0]
    ? `Clear overdue task`
    : (milestones.data ?? []).find((row) => row.due_on && row.due_on < day && row.status !== "completed" && row.status !== "cancelled")
      ? "Review an overdue milestone"
      : project.due_on && project.due_on < day && project.status !== "completed"
        ? "Project due date has passed"
        : "No overdue work on this project";
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    dueOn: project.due_on,
    billingMode: project.billing_mode,
    client: client ? { id: project.client_id, name: client.name } : null,
    tasks: { open: openTasks.length, overdue: overdueTasks.length },
    hours: Math.round((hoursMillis / 1000) * 10) / 10,
    milestones: (milestones.data ?? []).map((row) => ({ id: row.id, name: row.name, status: row.status, dueOn: row.due_on })),
    documents: documents.data ?? [],
    finance: finance && "byCurrency" in finance ? finance.byCurrency : null,
    nextAction: next,
  };
}

export async function entityContext(ctx: OrgContext, input: { clientId?: string; projectId?: string; leadId?: string; id?: string; kind?: string }) {
  const kind = input.kind || (input.projectId ? "project" : input.leadId ? "lead" : input.clientId ? "client" : "");
  const id = input.projectId || input.leadId || input.clientId || input.id || "";
  if (kind === "project" || (!kind && input.projectId)) return projectHealth(ctx, id);
  if (kind === "lead" || input.leadId) {
    if (!moduleOpen(ctx, "crm")) return { error: "You don't have access to leads in this studio." };
    const { data: lead } = await ctx.supabase
      .from("leads")
      .select("id, name, company, email, stage, next_action, next_action_on, estimated_value_minor, currency, updated_at")
      .eq("organization_id", ctx.org.id)
      .eq("id", id)
      .maybeSingle();
    if (!lead) return { error: "Lead not found" };
    const { data: notes } = await ctx.supabase
      .from("lead_activities")
      .select("kind, body, created_at")
      .eq("organization_id", ctx.org.id)
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(5);
    return { kind: "lead", ...lead, recentNotes: notes ?? [] };
  }
  if (!canAccessModule(ctx.permissions, "delivery") && !canAccessModule(ctx.permissions, "finance")) {
    return { error: "You don't have access to that record." };
  }
  const { data: client } = await ctx.supabase
    .from("clients")
    .select("id, name, currency, email")
    .eq("organization_id", ctx.org.id)
    .eq("id", id)
    .maybeSingle();
  if (!client) return { error: "Client not found" };
  const [projects, documents, finance] = await Promise.all([
    ctx.supabase.from("projects").select("id, name, status, due_on").eq("organization_id", ctx.org.id).eq("client_id", id).limit(12),
    moduleOpen(ctx, "documents")
      ? ctx.supabase.from("documents").select("id, title, status").eq("organization_id", ctx.org.id).eq("client_id", id).limit(8)
      : Promise.resolve({ data: [] }),
    snapshots(ctx, { clientId: id }),
  ]);
  return {
    kind: "client",
    client,
    projects: projects.data ?? [],
    documents: documents.data ?? [],
    finance: finance && "byCurrency" in finance ? finance.byCurrency : null,
  };
}

export async function financialSnapshot(ctx: OrgContext, scope: { clientId?: string; projectId?: string }) {
  const finance = await snapshots(ctx, scope);
  if (!finance) return { error: "You don't have access to finance in this studio, so amounts are not available." };
  if ("error" in finance) return finance;
  const agreements = await contracted(ctx, scope);
  return { finance: finance.byCurrency, contracted: agreements };
}
