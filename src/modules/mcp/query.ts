import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DATASETS,
  MEASURES,
  datasetByName,
  fieldByName,
  type Dataset,
  type Field,
} from "@/modules/mcp/catalog";
import { studioFor } from "@/modules/mcp/reads";
import {
  asLedgerMinor,
  clientMoneySnapshot,
  monthBounds,
  statementForMonth,
  withChargeOutstanding,
  type AllocationRow,
  type ChargeRow,
  type PaymentRow,
} from "@/modules/finance/ledger";
import type { OrgContext } from "@/modules/identity/org";
import { canAccessModule, canSeeMoney } from "@/modules/identity/permissions";
import type { ModuleKey } from "@/modules/identity/types";
import { asIsoCurrency, formatMoney, type IsoCurrency } from "@/shared/money";

type Reader = { supabase: SupabaseClient; userId: string };
type Row = Record<string, unknown>;

const PAGE_MAX = 100;
const AGG_CAP = 2000;
const LEDGER_CAP = 5000;
const SOURCE_CAP = 30;
const INCLUDE_CAP = 80;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type PeriodInput = {
  relative?: "this_month" | "last_month" | "last_30_days";
  from?: string;
  to?: string;
};

export type QueryFilter = {
  field: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is_null";
  value?: string | number | boolean | string[] | null;
};

export type QueryAggregate = {
  fn: "count" | "sum" | "min" | "max";
  field?: string;
};

export type StudioQuery = {
  org?: string;
  dataset?: string;
  fields?: string[];
  filters?: QueryFilter[];
  text?: string;
  period?: PeriodInput;
  groupBy?: string[];
  aggregates?: QueryAggregate[];
  comparePrevious?: boolean;
  include?: string[];
  cursor?: string;
  limit?: number;
  measure?: "billed" | "collected" | "outstanding" | "overdue" | "contracted";
};

type Period = { from: string; to: string; label: string; timeZone: string };

type QueryBuilder = {
  eq: (column: string, value: unknown) => QueryBuilder;
  neq: (column: string, value: unknown) => QueryBuilder;
  gt: (column: string, value: unknown) => QueryBuilder;
  gte: (column: string, value: unknown) => QueryBuilder;
  lt: (column: string, value: unknown) => QueryBuilder;
  lte: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, value: unknown[]) => QueryBuilder;
  is: (column: string, value: null) => QueryBuilder;
  or: (filters: string) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  range: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
  limit: (count: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
};

function studioToday(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolvePeriod(
  timeZone: string,
  input: PeriodInput | undefined,
): Period | { error: string } | null {
  if (!input || (!input.relative && !input.from && !input.to)) return null;
  if (input.from || input.to) {
    if (!input.from || !input.to || !ISO_DATE.test(input.from) || !ISO_DATE.test(input.to)) {
      return { error: "Period from and to must both be YYYY-MM-DD. to is exclusive." };
    }
    if (input.from >= input.to) return { error: "Period from must be before to." };
    return { from: input.from, to: input.to, label: `${input.from} until ${input.to}`, timeZone };
  }
  const today = studioToday(timeZone);
  if (input.relative === "this_month" || input.relative === "last_month") {
    const [year, month] = today.slice(0, 7).split("-").map(Number);
    const ym =
      input.relative === "this_month"
        ? today.slice(0, 7)
        : month === 1
          ? `${year - 1}-12`
          : `${year}-${String(month - 1).padStart(2, "0")}`;
    const bounds = monthBounds(ym);
    return { from: bounds.periodStart, to: bounds.periodEndExclusive, label: ym, timeZone };
  }
  if (input.relative === "last_30_days") {
    return {
      from: addDays(today, -29),
      to: addDays(today, 1),
      label: "last 30 days",
      timeZone,
    };
  }
  return { error: "Relative period must be this_month, last_month, or last_30_days." };
}

function previousPeriod(period: Period): Period {
  const start = Date.parse(`${period.from}T00:00:00Z`);
  const end = Date.parse(`${period.to}T00:00:00Z`);
  const length = Math.max(1, Math.round((end - start) / 86_400_000));
  const from = addDays(period.from, -length);
  return { ...period, from, to: period.from, label: `the period before ${period.label}` };
}

function moduleOpen(ctx: OrgContext, module: ModuleKey | null) {
  if (!module) return true;
  return Boolean(ctx.org.modules[module]) && canAccessModule(ctx.permissions, module);
}

function visibleFields(dataset: Dataset, seeMoney: boolean) {
  return dataset.fields.filter((field) => seeMoney || !field.finance);
}

function datasetAllowed(ctx: OrgContext, dataset: Dataset) {
  if (dataset.financeOnly && !moduleOpen(ctx, "finance")) {
    return "You don't have access to finance in this studio, so amounts are not available.";
  }
  if (dataset.name === "record_events") {
    if (!moduleOpen(ctx, "crm") && !moduleOpen(ctx, "delivery")) {
      return "You don't have access to leads or delivery in this studio.";
    }
    return null;
  }
  if (dataset.module && !moduleOpen(ctx, dataset.module)) {
    return `You don't have access to ${dataset.module} in this studio.`;
  }
  return null;
}

function moneyOut(minor: bigint, currency: string) {
  const code = currency.trim().toUpperCase();
  const known = asIsoCurrency(code, "USD");
  const formatted = known === code ? formatMoney({ amountMinor: minor, currency: known }) : null;
  return { minor: minor.toString(), currency: code || null, formatted };
}

export async function describeStudioData(reader: Reader, input: { org?: string }) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  const seeMoney = canSeeMoney(ctx.permissions);
  const datasets = DATASETS.filter((dataset) => !datasetAllowed(ctx, dataset)).map((dataset) => ({
    name: dataset.name,
    description: dataset.description,
    dateField: dataset.dateField ?? null,
    fields: visibleFields(dataset, seeMoney).map((field) => ({
      name: field.name,
      type: field.type,
      meaning: field.meaning,
      money: Boolean(field.finance),
      searchable: Boolean(field.searchable),
    })),
    include: dataset.relations
      .map((relation) => relation.dataset)
      .filter((name) => {
        const related = datasetByName(name);
        return related ? !datasetAllowed(ctx, related) : false;
      }),
  }));
  return {
    studio: { slug: ctx.org.slug, name: ctx.org.name, timezone: ctx.org.timezone },
    canSeeMoney: seeMoney,
    datasets,
    measures: seeMoney ? MEASURES : [],
    notes: [
      "Call query_studio with these field names. Relative periods use this studio's timezone.",
      "Currencies are never added together.",
      "billed, collected, outstanding, overdue, and contracted are measures. A sum of any other number is that column only.",
      "If nextCursor is returned, the list was cut off. Call query_studio again with that cursor.",
      "Use include for a directly related dataset, or call query_studio again with those ids when the link is further away.",
    ],
  };
}

export async function queryStudio(reader: Reader, input: StudioQuery) {
  const ctx = await studioFor(reader, input.org);
  if ("error" in ctx) return ctx;
  if (input.measure) return runMeasure(ctx, input);
  if (!input.dataset) return { error: "Pass dataset, or measure for billed, collected, outstanding, overdue, or contracted." };
  const dataset = datasetByName(input.dataset);
  if (!dataset) return { error: `Unknown dataset "${input.dataset}". Call describe_studio_data.` };
  const denied = datasetAllowed(ctx, dataset);
  if (denied) return { error: denied };
  const period = resolvePeriod(ctx.org.timezone, input.period);
  if (period && "error" in period) return period;
  if (input.comparePrevious && !period) {
    return { error: "Pass a period to compare it with the previous one." };
  }
  const current = await runDataset(ctx, dataset, input, period);
  if (!input.comparePrevious || !period || (current && typeof current === "object" && "error" in current)) {
    return current;
  }
  const previous = await runDataset(ctx, dataset, { ...input, comparePrevious: false, include: undefined, cursor: undefined }, previousPeriod(period));
  return { current, previous };
}

async function runDataset(
  ctx: OrgContext,
  dataset: Dataset,
  input: StudioQuery,
  period: Period | null,
) {
  const seeMoney = canSeeMoney(ctx.permissions);
  const fields = visibleFields(dataset, seeMoney);
  const selected = selectFields(dataset, fields, input.fields);
  if ("error" in selected) return selected;
  if (dataset.members) return runMembers(ctx, dataset, selected.fields, input, period);

  const grouped = Boolean(input.groupBy?.length || input.aggregates?.length);
  const limit = Math.min(PAGE_MAX, Math.max(1, input.limit ?? 50));
  const offset = input.cursor ? decodeCursor(input.cursor) : 0;
  if (typeof offset !== "number") return offset;

  const filters = validateFilters(dataset, fields, input.filters);
  if ("error" in filters) return filters;
  if (period && !dataset.dateField) {
    return { error: `${dataset.name} has no default date. Filter a date field directly, or omit period.` };
  }

  const columns = columnsFor(dataset, selected.fields, input, grouped);
  let query = ctx.supabase.from(dataset.table).select(columns.join(",")) as unknown as QueryBuilder;
  query = query.eq("organization_id", ctx.org.id);
  if (dataset.table === "files") query = query.is("deleted_at", null);
  if (dataset.name === "record_events") {
    const lead = moduleOpen(ctx, "crm");
    const task = moduleOpen(ctx, "delivery");
    if (lead && !task) query = query.eq("entity_type", "lead");
    if (task && !lead) query = query.eq("entity_type", "task");
  }
  query = applyFilters(query, dataset, filters.filters);
  if (period && dataset.dateField) {
    query = query.gte(dataset.dateField, period.from).lt(dataset.dateField, period.to);
  }
  const text = input.text?.trim();
  if (text) {
    const pattern = text.replace(/[%_,.()"'\\]/g, " ").trim().replace(/\s+/g, "%");
    const searchable = selected.fields.filter((field) => field.searchable);
    if (!pattern) return { error: "Text search was empty after removing special characters." };
    if (searchable.length === 0) return { error: `${dataset.name} has no text fields to search.` };
    query = query.or(searchable.map((field) => `${field.column}.ilike.%${pattern}%`).join(","));
  }

  if (grouped) {
    const { data, error } = await query.order(dataset.orderField, { ascending: false }).limit(AGG_CAP + 1);
    if (error) return { error: error.message };
    const loaded = data ?? [];
    const truncated = loaded.length > AGG_CAP;
    const rows = await labelRows(ctx, truncated ? loaded.slice(0, AGG_CAP) : loaded);
    const aggregated = aggregate(dataset, selected.fields, rows, input, seeMoney);
    if ("error" in aggregated) return aggregated;
    const labeled = rows.slice(0, SOURCE_CAP);
    return {
      dataset: dataset.name,
      period,
      ...aggregated,
      sourceRows: presentRows(dataset, selected.fields, labeled, seeMoney),
      sourceTruncated: rows.length > SOURCE_CAP || truncated,
      truncated,
      note: [
        truncated ? `Only the first ${AGG_CAP} rows were calculated. The total may be incomplete.` : null,
        aggregated.voidsExcluded ? "Void rows were left out of this calculation." : null,
        rows.length > SOURCE_CAP ? `Only the first ${SOURCE_CAP} source rows are included.` : null,
      ]
        .filter(Boolean)
        .join(" ") || null,
    };
  }

  const { data, error } = await query
    .order(dataset.orderField, { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + limit);
  if (error) return { error: error.message };
  const loaded = data ?? [];
  const hasMore = loaded.length > limit;
  const page = loaded.slice(0, limit);
  const labeled = await labelRows(ctx, page);
  const rows = presentRows(dataset, selected.fields, labeled, seeMoney);
  const included = input.include?.length ? await loadIncludes(ctx, dataset, page, input.include, seeMoney) : null;
  if (included && "error" in included) return included;
  return {
    dataset: dataset.name,
    period,
    rows,
    included,
    nextCursor: hasMore ? encodeCursor(offset + limit) : null,
    truncated: hasMore,
  };
}

function selectFields(dataset: Dataset, fields: Field[], requested: string[] | undefined) {
  if (!requested?.length) return { fields };
  const chosen: Field[] = [];
  for (const name of requested) {
    const field = fields.find((item) => item.name === name) ?? fieldByName(dataset, name);
    if (!field) return { error: `${dataset.name} has no field "${name}".` };
    if (!fields.includes(field)) return { error: `You can't read ${dataset.name}.${name}.` };
    chosen.push(field);
  }
  const idField = fields.find((field) => field.name === "id");
  if (idField && !chosen.includes(idField)) chosen.unshift(idField);
  return { fields: chosen };
}

function columnsFor(dataset: Dataset, fields: Field[], input: StudioQuery, grouped: boolean) {
  const names = new Set(fields.map((field) => field.column));
  if (grouped) {
    for (const group of input.groupBy ?? []) {
      if (group !== "month") {
        const field = fields.find((item) => item.name === group);
        if (field) names.add(field.column);
      }
    }
    for (const aggregate of input.aggregates ?? []) {
      if (aggregate.field) names.add(aggregate.field);
    }
    if (dataset.currencyField) names.add(dataset.currencyField);
    if (dataset.excludeVoidFromSums) names.add("status");
    if (dataset.dateField) names.add(dataset.dateField);
    if (dataset.name === "payments") names.add("kind");
  }
  if (fields.some((field) => field.name === "client_id")) names.add("client_id");
  if (fields.some((field) => field.name === "project_id")) names.add("project_id");
  if (dataset.fields.some((field) => field.name === "id")) names.add("id");
  return [...names];
}

function validateFilters(dataset: Dataset, fields: Field[], filters: QueryFilter[] | undefined) {
  const accepted: QueryFilter[] = [];
  for (const filter of filters ?? []) {
    const field = fields.find((item) => item.name === filter.field);
    if (!field) {
      const hidden = fieldByName(dataset, filter.field);
      if (hidden) return { error: `You can't filter on ${dataset.name}.${filter.field}.` };
      return { error: `${dataset.name} has no field "${filter.field}".` };
    }
    if (filter.op === "in") {
      if (!Array.isArray(filter.value) || filter.value.length === 0 || filter.value.length > 100) {
        return { error: `Filter ${filter.field} in expects 1 to 100 values.` };
      }
    } else if (filter.op !== "is_null" && (filter.value === undefined || filter.value === null)) {
      return { error: `Filter ${filter.field} needs a value.` };
    }
    accepted.push(filter);
  }
  return { filters: accepted };
}

function applyFilters(query: QueryBuilder, dataset: Dataset, filters: QueryFilter[]) {
  let next = query;
  for (const filter of filters) {
    const column = fieldByName(dataset, filter.field)?.column ?? filter.field;
    if (filter.op === "eq") next = next.eq(column, filter.value);
    else if (filter.op === "neq") next = next.neq(column, filter.value);
    else if (filter.op === "gt") next = next.gt(column, filter.value);
    else if (filter.op === "gte") next = next.gte(column, filter.value);
    else if (filter.op === "lt") next = next.lt(column, filter.value);
    else if (filter.op === "lte") next = next.lte(column, filter.value);
    else if (filter.op === "in") next = next.in(column, filter.value as string[]);
    else if (filter.op === "is_null") next = next.is(column, null);
  }
  return next;
}

function aggregate(
  dataset: Dataset,
  fields: Field[],
  loaded: Row[],
  input: StudioQuery,
  seeMoney: boolean,
) {
  const askedForVoids = (input.filters ?? []).some(
    (filter) => filter.field === "status" && filter.op === "eq" && filter.value === "void",
  );
  const rows =
    dataset.excludeVoidFromSums && !askedForVoids
      ? loaded.filter((row) => row.status !== "void")
      : loaded;
  const groupBy = input.groupBy ?? [];
  for (const group of groupBy) {
    if (group === "month") {
      if (!dataset.dateField) return { error: `${dataset.name} has no date to group by month.` };
      continue;
    }
    if (!fields.some((field) => field.name === group)) {
      return { error: `${dataset.name} has no field "${group}" to group by.` };
    }
  }
  const aggregates = input.aggregates?.length ? input.aggregates : [{ fn: "count" as const }];
  for (const aggregate of aggregates) {
    if (aggregate.fn === "count") continue;
    const field = fields.find((item) => item.name === aggregate.field);
    if (!field) return { error: `Aggregate ${aggregate.fn} needs a field on ${dataset.name}.` };
    if (aggregate.fn === "sum" && field.type !== "number" && field.type !== "money") {
      return { error: `${field.name} is not a number, so it cannot be summed.` };
    }
  }

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = groupBy
      .map((group) => {
        if (group === "month") return String(row[dataset.dateField ?? ""] ?? "").slice(0, 7) || "unknown";
        return String(row[group] ?? "null");
      })
      .join(" | ");
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key || "all", list);
  }
  if (groups.size === 0) groups.set("all", []);

  const result = [...groups.entries()].map(([key, groupRows]) => ({
    key: groupBy.length ? key : "all",
    count: groupRows.length,
    values: Object.fromEntries(
      aggregates
        .filter((item) => item.fn !== "count")
        .map((item) => {
          const fn = item.fn as "sum" | "min" | "max";
          const field = fields.find((candidate) => candidate.name === item.field)!;
          return [field.name, reduceField(dataset, field, groupRows, fn, seeMoney)];
        }),
    ),
  }));
  return { groups: result, voidsExcluded: Boolean(dataset.excludeVoidFromSums && !askedForVoids) };
}

function reduceField(dataset: Dataset, field: Field, rows: Row[], fn: "sum" | "min" | "max", seeMoney: boolean) {
  if (!seeMoney && field.finance) return null;
  const meaning = field.meaning;
  if (field.type === "money" || (dataset.name === "payments" && field.name === "amount_minor")) {
    const buckets = new Map<string, bigint[]>();
    for (const row of rows) {
      if (row[field.column] == null) continue;
      const currency = String(row[dataset.currencyField ?? "currency"] ?? "");
      const kind = dataset.name === "payments" ? String(row.kind ?? "") : "";
      const bucket = kind ? `${currency}|${kind}` : currency;
      const list = buckets.get(bucket) ?? [];
      list.push(asLedgerMinor(row[field.column] as string | number | bigint));
      buckets.set(bucket, list);
    }
    return {
      column: field.name,
      meaning,
      byCurrency: [...buckets.entries()].map(([bucket, amounts]) => {
        const [currency, kind] = bucket.split("|");
        const minor =
          fn === "sum"
            ? amounts.reduce((total, amount) => total + amount, BigInt(0))
            : fn === "min"
              ? amounts.reduce((min, amount) => (amount < min ? amount : min))
              : amounts.reduce((max, amount) => (amount > max ? amount : max));
        return { ...moneyOut(minor, currency), kind: kind || null };
      }),
    };
  }
  const numbers = rows
    .map((row) => row[field.column])
    .filter((value) => value != null)
    .map((value) => (field.type === "number" ? Number(value) : String(value)));
  if (numbers.length === 0) return { column: field.name, meaning, value: null };
  if (fn === "sum") {
    const total = numbers.reduce<number>((sum, value) => sum + Number(value), 0);
    return {
      column: field.name,
      meaning,
      value: total,
      hours: field.name === "hours_millis" ? Math.round((total / 3_600_000) * 100) / 100 : undefined,
    };
  }
  const sorted = [...numbers].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const value = fn === "min" ? sorted[0] : sorted[sorted.length - 1];
  return { column: field.name, meaning, value };
}

function presentRows(dataset: Dataset, fields: Field[], rows: Row[], seeMoney: boolean) {
  return rows.map((row) => {
    const out: Row = {};
    for (const field of fields) {
      if (field.finance && !seeMoney) continue;
      const value = row[field.column];
      if (field.type === "money") {
        const currency = String(row[dataset.currencyField ?? "currency"] ?? row.currency ?? "");
        out[field.name] =
          value == null ? null : moneyOut(asLedgerMinor(value as string | number | bigint), currency);
      } else if (field.name === "hours_millis") {
        out.hours_millis = value == null ? null : Number(value);
        out.hours = value == null ? null : Math.round((Number(value) / 3_600_000) * 100) / 100;
      } else {
        out[field.name] = value ?? null;
      }
    }
    if (typeof row.client_name === "string") out.client_name = row.client_name;
    if (typeof row.project_name === "string") out.project_name = row.project_name;
    return out;
  });
}

async function labelRows(ctx: OrgContext, rows: Row[]) {
  const clientIds = uniqueStrings(rows.map((row) => row.client_id));
  const projectIds = uniqueStrings(rows.map((row) => row.project_id));
  const clientNames = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data } = await ctx.supabase
      .from("clients")
      .select("id, name, currency")
      .eq("organization_id", ctx.org.id)
      .in("id", clientIds);
    for (const row of data ?? []) clientNames.set(row.id as string, row.name as string);
    for (const row of rows) {
      if (typeof row.client_id === "string") {
        const name = clientNames.get(row.client_id);
        if (name) row.client_name = name;
        const match = (data ?? []).find((client: { id: string; currency: string }) => client.id === row.client_id);
        if (match && row.currency == null) row.currency = match.currency;
      }
    }
  }
  if (projectIds.length > 0) {
    const { data } = await ctx.supabase
      .from("projects")
      .select("id, name, clients(currency)")
      .eq("organization_id", ctx.org.id)
      .in("id", projectIds);
    for (const row of (data ?? []) as {
      id: string;
      name: string;
      clients: { currency: string } | { currency: string }[] | null;
    }[]) {
      const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
      for (const target of rows) {
        if (target.project_id !== row.id) continue;
        target.project_name = row.name;
        if (target.currency == null && client && "currency" in client) target.currency = client.currency;
      }
    }
  }
  return rows;
}

async function loadIncludes(
  ctx: OrgContext,
  dataset: Dataset,
  rows: Row[],
  names: string[],
  seeMoney: boolean,
) {
  if (names.length > 3) return { error: "Include at most 3 related datasets." };
  const included: Record<string, unknown> = {};
  for (const name of names) {
    const relation = dataset.relations.find((item) => item.dataset === name);
    const related = datasetByName(name);
    if (!relation || !related) return { error: `${dataset.name} does not link to ${name}.` };
    const denied = datasetAllowed(ctx, related);
    if (denied) return { error: denied };
    const keys = uniqueStrings(rows.map((row) => row[relation.from]));
    if (keys.length === 0) {
      included[name] = [];
      continue;
    }
    const fields = visibleFields(related, seeMoney);
    const columns = fields.map((field) => field.column);
    let query = ctx.supabase.from(related.table).select(columns.join(",")) as unknown as QueryBuilder;
    query = query.eq("organization_id", ctx.org.id).in(relation.to, keys.slice(0, 100));
    const { data, error } = await query.limit(INCLUDE_CAP + 1);
    if (error) return { error: error.message };
    const loaded = data ?? [];
    included[name] = {
      rows: presentRows(related, fields, loaded.slice(0, INCLUDE_CAP), seeMoney),
      truncated: loaded.length > INCLUDE_CAP,
    };
  }
  return included;
}

async function runMembers(
  ctx: OrgContext,
  dataset: Dataset,
  fields: Field[],
  input: StudioQuery,
  period: Period | null,
) {
  if (period) return { error: "Members have no business date. Omit period." };
  if (input.groupBy?.length || input.aggregates?.length) {
    return { error: "Group members by role with a filter, or count them from the returned rows." };
  }
  const { data, error } = await ctx.supabase
    .from("organization_members")
    .select("user_id, role, status")
    .eq("organization_id", ctx.org.id);
  if (error) return { error: error.message };
  const members = (data ?? []) as { user_id: string; role: string; status: string }[];
  const ids = members.map((row) => row.user_id);
  const profiles = new Map<string, { display_name: string | null; job_title: string | null }>();
  if (ids.length > 0) {
    const profileResult = await ctx.supabase
      .from("profiles")
      .select("id, display_name, job_title")
      .in("id", ids);
    if (profileResult.error) return { error: profileResult.error.message };
    for (const profile of profileResult.data ?? []) {
      profiles.set(profile.id as string, {
        display_name: (profile.display_name as string | null) ?? null,
        job_title: (profile.job_title as string | null) ?? null,
      });
    }
  }
  let rows = members.map((member) => {
    const profile = profiles.get(member.user_id);
    return {
      user_id: member.user_id,
      display_name: profile?.display_name ?? null,
      job_title: profile?.job_title ?? null,
      role: member.role,
      status: member.status,
    };
  });
  for (const filter of input.filters ?? []) {
    if (!fields.some((field) => field.name === filter.field)) {
      return { error: `members has no field "${filter.field}".` };
    }
    if (!["eq", "neq", "in", "is_null"].includes(filter.op)) {
      return { error: `Members filters support eq, neq, in, and is_null.` };
    }
    rows = rows.filter((row) => {
      const value = row[filter.field as keyof typeof row];
      if (filter.op === "eq") return value === filter.value;
      if (filter.op === "neq") return value !== filter.value;
      if (filter.op === "is_null") return value == null;
      return Array.isArray(filter.value) && filter.value.includes(String(value));
    });
  }
  const text = input.text?.trim().toLowerCase();
  if (text) {
    rows = rows.filter((row) =>
      `${row.display_name ?? ""} ${row.job_title ?? ""}`.toLowerCase().includes(text),
    );
  }
  const limit = Math.min(PAGE_MAX, Math.max(1, input.limit ?? 50));
  const offset = input.cursor ? decodeCursor(input.cursor) : 0;
  if (typeof offset !== "number") return offset;
  const page = rows.slice(offset, offset + limit);
  return {
    dataset: dataset.name,
    period: null,
    rows: page,
    nextCursor: offset + limit < rows.length ? encodeCursor(offset + limit) : null,
    truncated: offset + limit < rows.length,
  };
}

async function runMeasure(ctx: OrgContext, input: StudioQuery) {
  if (!moduleOpen(ctx, "finance") || !canSeeMoney(ctx.permissions)) {
    return { error: "You don't have access to finance in this studio, so amounts are not available." };
  }
  const measure = input.measure!;
  const meaning = MEASURES.find((item) => item.name === measure)?.meaning ?? measure;
  const periodResult = resolvePeriod(ctx.org.timezone, input.period);
  if (periodResult && "error" in periodResult) return periodResult;
  if (input.comparePrevious && !periodResult) {
    return { error: "Pass a period to compare it with the previous one." };
  }
  const clientId = filterValue(input.filters, "client_id");
  const projectId = filterValue(input.filters, "project_id");
  if (isFailure(clientId)) return clientId;
  if (isFailure(projectId)) return projectId;
  const extra = (input.filters ?? []).filter((filter) => filter.field !== "client_id" && filter.field !== "project_id");
  if (extra.length > 0) {
    return { error: "A measure accepts filters on client_id and project_id only. Use dataset for anything else." };
  }

  if (measure === "contracted") {
    const current = await contracted(ctx, periodResult, typeof projectId === "string" ? projectId : null, typeof clientId === "string" ? clientId : null);
    if (!input.comparePrevious || !periodResult || "error" in current) return { measure, meaning, ...current };
    const previous = await contracted(ctx, previousPeriod(periodResult), typeof projectId === "string" ? projectId : null, typeof clientId === "string" ? clientId : null);
    return { measure, meaning, ...current, previous };
  }

  const ledger = await loadLedger(ctx, {
    clientId: typeof clientId === "string" ? clientId : null,
    projectId: typeof projectId === "string" ? projectId : null,
  });
  if ("error" in ledger) return ledger;
  const current = measureResult(measure, ledger, periodResult, ctx.org.timezone);
  if (!input.comparePrevious || !periodResult) return { measure, meaning, ...current };
  const previous = measureResult(measure, ledger, previousPeriod(periodResult), ctx.org.timezone);
  return { measure, meaning, ...current, previous };
}

function isFailure(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

function filterValue(filters: QueryFilter[] | undefined, field: string) {
  const match = (filters ?? []).filter((filter) => filter.field === field);
  if (match.length === 0) return null;
  if (match.length > 1 || match[0].op !== "eq" || typeof match[0].value !== "string") {
    return { error: `${field} on a measure must be a single eq value.` };
  }
  return match[0].value;
}

async function loadLedger(
  ctx: OrgContext,
  scope: { clientId: string | null; projectId: string | null },
): Promise<
  | { error: string }
  | {
      charges: ChargeRow[];
      payments: PaymentRow[];
      allocations: AllocationRow[];
      truncated: boolean;
      projectId: string | null;
    }
> {
  let chargesQuery = ctx.supabase
    .from("charges")
    .select(
      "id, client_id, project_id, milestone_id, work_log_id, gross_minor, fee_bps, net_minor, currency, charged_on, due_on, source, status, memo, created_at",
    )
    .eq("organization_id", ctx.org.id)
    .limit(LEDGER_CAP + 1);
  let paymentsQuery = ctx.supabase
    .from("payments")
    .select("id, client_id, amount_minor, currency, paid_on, method, reference, kind, status, created_at")
    .eq("organization_id", ctx.org.id)
    .limit(LEDGER_CAP + 1);
  if (scope.clientId) {
    chargesQuery = chargesQuery.eq("client_id", scope.clientId);
    paymentsQuery = paymentsQuery.eq("client_id", scope.clientId);
  }
  if (scope.projectId) chargesQuery = chargesQuery.eq("project_id", scope.projectId);
  const [chargesResult, paymentsResult, allocationsResult] = await Promise.all([
    chargesQuery,
    paymentsQuery,
    ctx.supabase
      .from("payment_allocations")
      .select("payment_id, charge_id, amount_minor")
      .eq("organization_id", ctx.org.id)
      .limit(LEDGER_CAP + 1),
  ]);
  if (chargesResult.error) return { error: chargesResult.error.message };
  if (paymentsResult.error) return { error: paymentsResult.error.message };
  if (allocationsResult.error) return { error: allocationsResult.error.message };
  const charges = (chargesResult.data ?? []).slice(0, LEDGER_CAP).map(mapCharge);
  const payments = (paymentsResult.data ?? []).slice(0, LEDGER_CAP).map(mapPayment);
  const allocations = (allocationsResult.data ?? []).slice(0, LEDGER_CAP).map(
    (row): AllocationRow => ({
      paymentId: row.payment_id as string,
      chargeId: row.charge_id as string,
      amountMinor: asLedgerMinor(row.amount_minor as string | number),
    }),
  );
  return {
    charges,
    payments,
    allocations,
    truncated:
      (chargesResult.data?.length ?? 0) > LEDGER_CAP ||
      (paymentsResult.data?.length ?? 0) > LEDGER_CAP ||
      (allocationsResult.data?.length ?? 0) > LEDGER_CAP,
    projectId: scope.projectId,
  };
}

function mapCharge(row: Row): ChargeRow {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    projectId: (row.project_id as string | null) ?? null,
    milestoneId: (row.milestone_id as string | null) ?? null,
    workLogId: (row.work_log_id as string | null) ?? null,
    grossMinor: asLedgerMinor(row.gross_minor as string | number),
    feeBps: Number(row.fee_bps),
    netMinor: asLedgerMinor(row.net_minor as string | number),
    currency: asIsoCurrency(String(row.currency)),
    chargedOn: String(row.charged_on),
    dueOn: (row.due_on as string | null) ?? null,
    source: String(row.source),
    status: row.status === "void" ? "void" : "open",
    memo: (row.memo as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function mapPayment(row: Row): PaymentRow {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    amountMinor: asLedgerMinor(row.amount_minor as string | number),
    currency: asIsoCurrency(String(row.currency)),
    paidOn: String(row.paid_on),
    method: String(row.method),
    reference: (row.reference as string | null) ?? null,
    kind: row.kind === "refund" ? "refund" : "receipt",
    status: row.status === "void" ? "void" : "posted",
    createdAt: String(row.created_at),
  };
}

type Ledger = Awaited<ReturnType<typeof loadLedger>>;

function measureResult(
  measure: "billed" | "collected" | "outstanding" | "overdue",
  ledger: Exclude<Ledger, { error: string }>,
  period: Period | null,
  timeZone: string,
) {
  const currencies = splitCurrencies(ledger.charges, ledger.payments);
  const asOf = period ? addDays(period.to, -1) : studioToday(timeZone);
  const month =
    period && period.from.endsWith("-01") && monthBounds(period.from.slice(0, 7)).periodEndExclusive === period.to
      ? period.from.slice(0, 7)
      : null;

  const totals = [...currencies].map((currency) => {
    const charges = ledger.charges.filter((row) => row.currency === currency);
    const payments = ledger.payments.filter((row) => row.currency === currency);
    if (measure === "billed" || measure === "collected") {
      if (ledger.projectId && measure === "collected") {
        return projectCollected(currency, charges, payments, ledger.allocations, period);
      }
      if (month && !ledger.projectId) {
        const statement = statementForMonth(charges, payments, month);
        const total = measure === "billed" ? statement.newCharges : statement.payments;
        return {
          ...moneyOut(total, currency),
          opening: moneyOut(statement.opening, currency),
          closing: moneyOut(statement.closing, currency),
          ...sourceLines(measure, charges, payments, period),
        };
      }
      const total =
        measure === "billed"
          ? sumOn(
              charges,
              period,
              (row: ChargeRow) => row.status !== "void",
              (row: ChargeRow) => row.chargedOn,
              (row: ChargeRow) => row.grossMinor,
            )
          : collectedMinor(payments, period);
      return { ...moneyOut(total, currency), ...sourceLines(measure, charges, payments, period) };
    }
    const untilCharges = charges.filter((row) => row.chargedOn <= asOf);
    const untilPayments = payments.filter((row) => row.paidOn <= asOf);
    if (ledger.projectId) {
      const views = withChargeOutstanding(untilCharges, ledger.allocations, untilPayments, asOf);
      const minor =
        measure === "overdue"
          ? views.filter((row) => row.overdue).reduce((sum, row) => sum + row.outstandingMinor, BigInt(0))
          : views.reduce((sum, row) => sum + row.outstandingMinor, BigInt(0));
      const matched = views.filter((row) =>
        measure === "overdue" ? row.overdue : row.outstandingMinor > BigInt(0),
      );
      return { ...moneyOut(minor, currency), ...capLines(matched, currency) };
    }
    const snapshot = clientMoneySnapshot(untilCharges, untilPayments, ledger.allocations, asOf);
    const minor = measure === "overdue" ? snapshot.overdueMinor : snapshot.outstandingMinor;
    const matched = withChargeOutstanding(untilCharges, ledger.allocations, untilPayments, asOf).filter((row) =>
      measure === "overdue" ? row.overdue : row.outstandingMinor > BigInt(0),
    );
    return { ...moneyOut(minor, currency), ...capLines(matched, currency) };
  });

  return {
    period: period ?? { asOf, timeZone },
    currencies: totals.filter((row) => {
      const opening = "opening" in row ? row.opening.minor : "0";
      const closing = "closing" in row ? row.closing.minor : "0";
      return row.minor !== "0" || opening !== "0" || closing !== "0" || row.lines.length > 0;
    }),
    truncated: ledger.truncated,
    note: [
      ledger.truncated ? "The ledger was cut off, so this total may be incomplete." : "Void rows are excluded.",
      "Currencies are separate.",
      totals.some((row) => row.linesTruncated)
        ? `Only the first ${SOURCE_CAP} source rows are included for each currency.`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function capLines(
  rows: { id: string; clientId: string; chargedOn: string; dueOn: string | null; outstandingMinor: bigint }[],
  currency: IsoCurrency,
) {
  return {
    lines: rows.slice(0, SOURCE_CAP).map((row) => ({
      id: row.id,
      clientId: row.clientId,
      on: row.chargedOn,
      dueOn: row.dueOn,
      amount: moneyOut(row.outstandingMinor, currency),
    })),
    linesTruncated: rows.length > SOURCE_CAP,
  };
}

function projectCollected(
  currency: IsoCurrency,
  charges: ChargeRow[],
  payments: PaymentRow[],
  allocations: AllocationRow[],
  period: Period | null,
) {
  const chargeIds = new Set(charges.map((row) => row.id));
  const paymentById = new Map(payments.map((row) => [row.id, row]));
  let total = BigInt(0);
  const lines: Row[] = [];
  let linesTruncated = false;
  for (const allocation of allocations) {
    if (!chargeIds.has(allocation.chargeId)) continue;
    const payment = paymentById.get(allocation.paymentId);
    if (!payment || payment.status !== "posted" || payment.currency !== currency) continue;
    if (period && (payment.paidOn < period.from || payment.paidOn >= period.to)) continue;
    const signed = payment.kind === "refund" ? -allocation.amountMinor : allocation.amountMinor;
    total += signed;
    if (lines.length < SOURCE_CAP) {
      lines.push({
        id: payment.id,
        chargeId: allocation.chargeId,
        kind: payment.kind,
        on: payment.paidOn,
        amount: moneyOut(signed, currency),
      });
    } else {
      linesTruncated = true;
    }
  }
  return { ...moneyOut(total, currency), lines, linesTruncated };
}

function collectedMinor(payments: PaymentRow[], period: Period | null) {
  const posted = (kind: PaymentRow["kind"]) =>
    sumOn(
      payments.filter((row) => row.kind === kind),
      period,
      (row: PaymentRow) => row.status === "posted",
      (row: PaymentRow) => row.paidOn,
      (row: PaymentRow) => row.amountMinor,
    );
  return posted("receipt") - posted("refund");
}

function sumOn<T>(
  rows: T[],
  period: Period | null,
  keep: (row: T) => boolean,
  on: (row: T) => string,
  amount: (row: T) => bigint,
) {
  return rows
    .filter((row) => keep(row) && (!period || (on(row) >= period.from && on(row) < period.to)))
    .reduce((total, row) => total + amount(row), BigInt(0));
}

function sourceLines(
  measure: "billed" | "collected",
  charges: ChargeRow[],
  payments: PaymentRow[],
  period: Period | null,
) {
  if (measure === "billed") {
    const matched = charges.filter(
      (row) => row.status !== "void" && (!period || (row.chargedOn >= period.from && row.chargedOn < period.to)),
    );
    return {
      lines: matched.slice(0, SOURCE_CAP).map((row) => ({
        id: row.id,
        clientId: row.clientId,
        projectId: row.projectId,
        on: row.chargedOn,
        amount: moneyOut(row.grossMinor, row.currency),
        memo: row.memo,
      })),
      linesTruncated: matched.length > SOURCE_CAP,
    };
  }
  const matched = payments.filter(
    (row) => row.status === "posted" && (!period || (row.paidOn >= period.from && row.paidOn < period.to)),
  );
  return {
    lines: matched.slice(0, SOURCE_CAP).map((row) => ({
      id: row.id,
      clientId: row.clientId,
      kind: row.kind,
      on: row.paidOn,
      amount: moneyOut(row.kind === "refund" ? -row.amountMinor : row.amountMinor, row.currency),
      reference: row.reference,
    })),
    linesTruncated: matched.length > SOURCE_CAP,
  };
}

function splitCurrencies(charges: ChargeRow[], payments: PaymentRow[]) {
  return new Set<IsoCurrency>([...charges.map((row) => row.currency), ...payments.map((row) => row.currency)]);
}

async function contracted(
  ctx: OrgContext,
  period: Period | null,
  projectId: string | null,
  clientId: string | null,
) {
  let query = ctx.supabase
    .from("projects")
    .select("id, name, client_id, status, contracted_amount_minor, starts_on, clients(name, currency)")
    .eq("organization_id", ctx.org.id)
    .neq("status", "cancelled")
    .limit(LEDGER_CAP + 1);
  if (projectId) query = query.eq("id", projectId);
  if (clientId) query = query.eq("client_id", clientId);
  if (period) query = query.gte("starts_on", period.from).lt("starts_on", period.to);
  const { data, error } = await query;
  if (error) return { error: error.message };
  const loaded = data ?? [];
  const buckets = new Map<string, { minor: bigint; lines: Row[] }>();
  for (const row of loaded.slice(0, LEDGER_CAP)) {
    if (row.contracted_amount_minor == null) continue;
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const currency = String(client?.currency ?? ctx.org.defaultCurrency);
    const bucket = buckets.get(currency) ?? { minor: BigInt(0), lines: [] };
    const amount = asLedgerMinor(row.contracted_amount_minor as string | number);
    bucket.minor += amount;
    if (bucket.lines.length < SOURCE_CAP) {
      bucket.lines.push({
        id: row.id,
        name: row.name,
        clientId: row.client_id,
        client: client?.name ?? null,
        status: row.status,
        startsOn: row.starts_on,
        amount: moneyOut(amount, currency),
      });
    }
    buckets.set(currency, bucket);
  }
  return {
    period,
    currencies: [...buckets.entries()].map(([currency, bucket]) => ({
      ...moneyOut(bucket.minor, currency),
      lines: bucket.lines,
      linesTruncated: bucket.lines.length >= SOURCE_CAP,
    })),
    truncated: loaded.length > LEDGER_CAP,
    note: "Contracted is the agreement on the project, split by the client currency. It is not cash received. Cancelled projects are excluded. A period filters starts_on.",
  };
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function encodeCursor(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): number | { error: string } {
  const offset = Number(Buffer.from(cursor, "base64url").toString("utf8"));
  if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) {
    return { error: "That page cursor is not valid." };
  }
  return offset;
}
