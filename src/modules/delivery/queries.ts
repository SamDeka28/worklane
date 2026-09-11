import { requireOrg } from "@/modules/identity/org";
import { asLedgerMinor } from "@/modules/finance/ledger";
import type {
  BoardColumn,
  MilestoneItemRecord,
  MilestoneRecord,
  MilestoneStatus,
  ProjectRecord,
  TaskComment,
  TaskPriority,
  TaskRecord,
  TaskStatus,
  WorkLogRecord,
} from "@/modules/delivery/types";
import {
  BILLING_MODES,
  MILESTONE_STATUSES,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/modules/delivery/types";

function asStatus<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function mapProject(row: {
  id: string;
  organization_id: string;
  client_id: string;
  name: string;
  status: string;
  billing_mode: string;
  default_fee_bps: number;
  earn_on: string;
  contracted_amount_minor: string | number | null;
  scope: string | null;
  scope_doc: Record<string, unknown> | null;
  starts_on: string | null;
  due_on: string | null;
  created_at: string;
  clients?: { name: string; currency: string } | { name: string; currency: string }[] | null;
}): ProjectRecord {
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  return {
    id: row.id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    clientName: client?.name ?? "Client",
    currency: client?.currency === "INR" ? "INR" : "USD",
    name: row.name,
    status: asStatus(row.status, PROJECT_STATUSES, "active"),
    billingMode: asStatus(row.billing_mode, BILLING_MODES, "hourly"),
    defaultFeeBps: row.default_fee_bps,
    earnOn: row.earn_on === "receipt" ? "receipt" : "charge",
    contractedAmountMinor:
      row.contracted_amount_minor == null ? null : asLedgerMinor(row.contracted_amount_minor),
    scope: row.scope,
    scopeDoc: row.scope_doc,
    startsOn: row.starts_on,
    dueOn: row.due_on,
    createdAt: row.created_at,
  };
}

const PROJECT_SELECT =
  "id, organization_id, client_id, name, status, billing_mode, default_fee_bps, earn_on, contracted_amount_minor, scope, scope_doc, starts_on, due_on, created_at, clients(name, currency)";

export async function listProjects(orgSlug: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProject);
}

export async function listClientProjects(orgSlug: string, clientId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("organization_id", org.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProject);
}

export async function getProject(orgSlug: string, projectId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("organization_id", org.id)
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapProject(data) : null;
}

export async function listMilestones(orgSlug: string, projectId: string) {
  const { org, supabase } = await requireOrg(orgSlug);

  const attempts = [
    "id, project_id, name, status, amount_minor, due_on, description, description_doc, charge_id, billed_at, created_at",
    "id, project_id, name, status, amount_minor, due_on, deliverables, deliverables_doc, charge_id, billed_at, created_at",
    "id, project_id, name, status, amount_minor, due_on, description, charge_id, billed_at, created_at",
    "id, project_id, name, status, amount_minor, due_on, deliverables, charge_id, billed_at, created_at",
  ];

  let rows: Record<string, unknown>[] | null = null;
  let lastError: string | null = null;
  for (const select of attempts) {
    const result = await supabase
      .from("milestones")
      .select(select)
      .eq("organization_id", org.id)
      .eq("project_id", projectId)
      .order("created_at");
    if (!result.error) {
      rows = (result.data ?? []) as unknown as Record<string, unknown>[];
      break;
    }
    lastError = result.error.message;
  }
  if (!rows) throw new Error(lastError ?? "Could not load milestones");

  return rows.map((row): MilestoneRecord => {
    const description =
      (row.description as string | null | undefined) ??
      (row.deliverables as string | null | undefined) ??
      null;
    const descriptionDoc =
      (row.description_doc as Record<string, unknown> | null | undefined) ??
      (row.deliverables_doc as Record<string, unknown> | null | undefined) ??
      null;
    const amountRaw = row.amount_minor;
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      name: row.name as string,
      status: asStatus(row.status as string, MILESTONE_STATUSES, "planned") as MilestoneStatus,
      amountMinor:
        amountRaw == null || amountRaw === ""
          ? null
          : asLedgerMinor(amountRaw as string | number | bigint),
      dueOn: (row.due_on as string | null) ?? null,
      description,
      descriptionDoc,
      deliverables: description,
      deliverablesDoc: descriptionDoc,
      chargeId: (row.charge_id as string | null) ?? null,
      billedAt: (row.billed_at as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

export async function listMilestoneItemsForProject(orgSlug: string, projectId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data: milestones, error: milestoneError } = await supabase
    .from("milestones")
    .select("id")
    .eq("organization_id", org.id)
    .eq("project_id", projectId);
  if (milestoneError) throw new Error(milestoneError.message);
  const ids = (milestones ?? []).map((row) => row.id as string);
  if (ids.length === 0) return new Map<string, MilestoneItemRecord[]>();

  const { data, error } = await supabase
    .from("milestone_items")
    .select("id, milestone_id, title, position, task_id, created_at")
    .eq("organization_id", org.id)
    .in("milestone_id", ids)
    .order("position")
    .order("created_at");

  if (error) {
    // Table may not exist yet before migration.
    if (/milestone_items|does not exist|schema cache/i.test(error.message)) {
      return new Map<string, MilestoneItemRecord[]>();
    }
    throw new Error(error.message);
  }

  const map = new Map<string, MilestoneItemRecord[]>();
  for (const row of data ?? []) {
    const item: MilestoneItemRecord = {
      id: row.id,
      milestoneId: row.milestone_id,
      title: row.title,
      position: row.position,
      taskId: row.task_id,
      createdAt: row.created_at,
    };
    const list = map.get(item.milestoneId) ?? [];
    list.push(item);
    map.set(item.milestoneId, list);
  }
  return map;
}

export async function listProjectColumns(orgSlug: string, projectId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("project_columns")
    .select("id, project_id, name, position, system_key")
    .eq("organization_id", org.id)
    .eq("project_id", projectId)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): BoardColumn => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      position: row.position,
      systemKey:
        row.system_key === "todo" || row.system_key === "doing" || row.system_key === "done"
          ? row.system_key
          : null,
    }),
  );
}

export async function listTasks(orgSlug: string, projectId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("tasks")
    .select("id, project_id, milestone_id, column_id, title, description, description_doc, status, priority, due_on, position, assignee_user_id, created_at")
    .eq("organization_id", org.id)
    .eq("project_id", projectId)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((row) => row.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const commentsRes = await supabase
      .from("task_comments")
      .select("task_id")
      .eq("organization_id", org.id)
      .in("task_id", ids);
    if (commentsRes.error) throw new Error(commentsRes.error.message);
    for (const row of commentsRes.data ?? []) {
      counts.set(row.task_id, (counts.get(row.task_id) ?? 0) + 1);
    }
  }

  return (data ?? []).map(
    (row): TaskRecord => ({
      id: row.id,
      projectId: row.project_id,
      milestoneId: row.milestone_id,
      columnId: row.column_id,
      title: row.title,
      description: row.description,
      descriptionDoc: (row.description_doc as Record<string, unknown> | null) ?? null,
      status: asStatus(row.status, TASK_STATUSES, "todo") as TaskStatus,
      priority: asStatus(row.priority, TASK_PRIORITIES, "medium") as TaskPriority,
      dueOn: row.due_on,
      position: row.position ?? 0,
      assigneeUserId: (row.assignee_user_id as string | null) ?? null,
      commentCount: counts.get(row.id) ?? 0,
      createdAt: row.created_at,
    }),
  );
}

export async function listTaskComments(orgSlug: string, taskIds: string[]) {
  if (taskIds.length === 0) return [] as TaskComment[];
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("task_comments")
    .select("id, task_id, body, body_doc, body_text, created_by, created_at")
    .eq("organization_id", org.id)
    .in("task_id", taskIds)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): TaskComment => ({
      id: row.id,
      taskId: row.task_id,
      body: (row.body_text as string | null) || row.body,
      bodyDoc: (row.body_doc as Record<string, unknown> | null) ?? null,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }),
  );
}

export async function listWorkLogs(orgSlug: string, projectId: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("work_logs")
    .select(
      "id, project_id, milestone_id, worked_on, hours_millis, hourly_rate_minor, fixed_minor, description, external_url, charge_id, created_at",
    )
    .eq("organization_id", org.id)
    .eq("project_id", projectId)
    .order("worked_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): WorkLogRecord => ({
      id: row.id,
      projectId: row.project_id,
      milestoneId: row.milestone_id,
      workedOn: row.worked_on,
      hoursMillis: row.hours_millis,
      hourlyRateMinor: row.hourly_rate_minor == null ? null : asLedgerMinor(row.hourly_rate_minor),
      fixedMinor: row.fixed_minor == null ? null : asLedgerMinor(row.fixed_minor),
      description: row.description,
      externalUrl: row.external_url,
      chargeId: row.charge_id,
      createdAt: row.created_at,
    }),
  );
}

export async function countProjects(orgSlug: string) {
  const { org, supabase } = await requireOrg(orgSlug);
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listProjectBoard(orgSlug: string) {
  const projects = await listProjects(orgSlug);
  if (projects.length === 0) {
    return [] as Array<{
      project: (typeof projects)[number];
      logCount: number;
      lastWorkedOn: string | null;
      openTasks: number;
      milestoneCount: number;
      unbilledMilestones: number;
    }>;
  }

  const { org, supabase } = await requireOrg(orgSlug);
  const ids = projects.map((project) => project.id);
  const [logsRes, tasksRes, milestonesRes] = await Promise.all([
    supabase
      .from("work_logs")
      .select("project_id, worked_on")
      .eq("organization_id", org.id)
      .in("project_id", ids),
    supabase
      .from("tasks")
      .select("project_id, status")
      .eq("organization_id", org.id)
      .in("project_id", ids),
    supabase
      .from("milestones")
      .select("project_id, charge_id, amount_minor")
      .eq("organization_id", org.id)
      .in("project_id", ids),
  ]);

  if (logsRes.error) throw new Error(logsRes.error.message);
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (milestonesRes.error) throw new Error(milestonesRes.error.message);

  return projects.map((project) => {
    const logs = (logsRes.data ?? []).filter((row) => row.project_id === project.id);
    const lastWorkedOn = logs.reduce<string | null>((latest, row) => {
      if (!latest || row.worked_on > latest) return row.worked_on;
      return latest;
    }, null);
    const projectMilestones = (milestonesRes.data ?? []).filter(
      (row) => row.project_id === project.id,
    );
    return {
      project,
      logCount: logs.length,
      lastWorkedOn,
      openTasks: (tasksRes.data ?? []).filter(
        (row) => row.project_id === project.id && row.status !== "done",
      ).length,
      milestoneCount: projectMilestones.length,
      unbilledMilestones: projectMilestones.filter(
        (row) => !row.charge_id && row.amount_minor != null,
      ).length,
    };
  });
}

/** Unbilled milestones with due dates — expected cash, not posted charges. */
export async function listExpectedBillings(orgSlug: string): Promise<
  {
    milestoneId: string;
    projectId: string;
    projectName: string;
    clientId: string;
    clientName: string;
    currency: "USD" | "INR";
    name: string;
    amountMinor: bigint;
    dueOn: string;
  }[]
> {
  const { org, supabase } = await requireOrg(orgSlug);
  const { data, error } = await supabase
    .from("milestones")
    .select(
      "id, project_id, name, amount_minor, due_on, charge_id, status, projects(id, name, client_id, clients(name, currency))",
    )
    .eq("organization_id", org.id)
    .is("charge_id", null)
    .neq("status", "cancelled")
    .not("due_on", "is", null)
    .not("amount_minor", "is", null)
    .order("due_on", { ascending: true });
  if (error) throw new Error(error.message);

  const rows: {
    milestoneId: string;
    projectId: string;
    projectName: string;
    clientId: string;
    clientName: string;
    currency: "USD" | "INR";
    name: string;
    amountMinor: bigint;
    dueOn: string;
  }[] = [];

  for (const row of data ?? []) {
    const projectJoin = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    if (!projectJoin || !row.due_on || row.amount_minor == null) continue;
    const clientJoin = Array.isArray(projectJoin.clients)
      ? projectJoin.clients[0]
      : projectJoin.clients;
    rows.push({
      milestoneId: row.id as string,
      projectId: projectJoin.id as string,
      projectName: projectJoin.name as string,
      clientId: projectJoin.client_id as string,
      clientName: (clientJoin?.name as string | undefined) ?? "Client",
      currency: clientJoin?.currency === "INR" ? "INR" : "USD",
      name: row.name as string,
      amountMinor: asLedgerMinor(row.amount_minor as string | number | bigint),
      dueOn: row.due_on as string,
    });
  }

  return rows;
}
