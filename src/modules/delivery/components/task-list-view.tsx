"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Columns3,
  Layers,
  MessageSquare,
  Plus,
} from "lucide-react";
import { AvatarStack } from "@/components/studio/avatar-mark";
import { ProjectChip } from "@/components/studio/project-chip";
import { StatusChip } from "@/components/studio/status-chip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CopyTaskLinkIcon } from "@/modules/delivery/components/copy-task-link";
import {
  KindMark,
  PRIORITY_MARK,
  PriorityMark,
} from "@/modules/delivery/components/task-board-card";
import { formatDay } from "@/modules/finance/presentation";
import type { BoardColumn, BoardTask, TaskStatus } from "@/modules/delivery/types";

type Person = { name: string; src?: string | null };

type ColumnKey = "project" | "status" | "assignee" | "priority" | "due" | "milestone" | "labels" | "comments";
type SortKey = "title" | ColumnKey;
type GroupKey = "none" | "status" | "project" | "priority" | "assignee";

const COLUMNS: { key: ColumnKey; label: string; width: string }[] = [
  { key: "project", label: "Project", width: "10rem" },
  { key: "status", label: "Status", width: "8.5rem" },
  { key: "assignee", label: "Assignee", width: "6.5rem" },
  { key: "priority", label: "Priority", width: "6.5rem" },
  { key: "due", label: "Due", width: "7rem" },
  { key: "milestone", label: "Milestone", width: "9rem" },
  { key: "labels", label: "Labels", width: "9rem" },
  { key: "comments", label: "Comments", width: "3.5rem" },
];

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "none", label: "No grouping" },
  { key: "status", label: "Status" },
  { key: "project", label: "Project" },
  { key: "priority", label: "Priority" },
  { key: "assignee", label: "Assignee" },
];

const STATUS_TONE: Record<TaskStatus, { dot: string; text: string }> = {
  todo: { dot: "bg-slate-400", text: "text-muted-foreground" },
  doing: { dot: "bg-sky-600", text: "text-sky-700 dark:text-sky-300" },
  done: { dot: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-300" },
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

function isOverdue(dueOn: string | null) {
  return Boolean(dueOn && dueOn < new Date().toISOString().slice(0, 10));
}

function toneFor(column: BoardColumn | undefined): TaskStatus {
  const key = column?.systemKey;
  return key === "todo" || key === "done" ? key : "doing";
}

type Row = { task: BoardTask; column: BoardColumn | undefined; columnIndex: number; order: number; people: Person[] };

/** Jira-style flat list with sorting, grouping, and column choice; status is a badge per row. */
export function TaskListView({
  columns,
  items,
  showProject,
  taskMilestoneRefs,
  peopleFor,
  canWrite,
  selectedTaskId,
  onOpenTask,
  onAddCard,
  onMove,
}: {
  columns: BoardColumn[];
  items: Map<string, BoardTask[]>;
  showProject: boolean;
  taskMilestoneRefs: Record<string, { code: string; label: string }>;
  peopleFor: (task: BoardTask) => Person[];
  canWrite: boolean;
  selectedTaskId: string | null;
  onOpenTask: (taskId: string) => void;
  onAddCard: (columnId: string) => void;
  onMove: (taskId: string, columnId: string) => void;
}) {
  const [visible, setVisible] = useState<Set<ColumnKey>>(
    () =>
      new Set<ColumnKey>(
        showProject
          ? ["project", "status", "assignee", "priority", "due", "comments"]
          : ["status", "assignee", "priority", "due", "milestone", "comments"],
      ),
  );
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [groupBy, setGroupBy] = useState<GroupKey>("none");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const shownColumns = COLUMNS.filter((column) => visible.has(column.key));
  const gridStyle = {
    "--cols": ["minmax(0,1fr)", ...shownColumns.map((column) => column.width)].join(" "),
  } as CSSProperties;

  const rows = useMemo(() => {
    const out: Row[] = [];
    let order = 0;
    columns.forEach((column, columnIndex) => {
      for (const task of items.get(column.id) ?? []) {
        out.push({ task, column, columnIndex, order: order++, people: peopleFor(task) });
      }
    });
    if (!sort) return out;
    const value = (row: Row): string | number => {
      switch (sort.key) {
        case "title":
          return row.task.title.toLowerCase();
        case "project":
          return (row.task.projectName ?? "").toLowerCase();
        case "status":
          return row.columnIndex;
        case "assignee":
          return row.people[0]?.name.toLowerCase() ?? "\uffff";
        case "priority":
          return PRIORITY_RANK[row.task.priority];
        case "due":
          return row.task.dueOn ?? "9999-99-99";
        case "milestone":
          return (taskMilestoneRefs[row.task.id]?.label ?? "\uffff").toLowerCase();
        case "labels":
          return (row.task.labels[0] ?? "\uffff").toLowerCase();
        case "comments":
          return row.task.commentCount;
      }
    };
    return [...out].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      if (left < right) return -sort.dir;
      if (left > right) return sort.dir;
      return a.order - b.order;
    });
  }, [columns, items, peopleFor, sort, taskMilestoneRefs]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ id: "all", label: "", dot: null as string | null, rows, addTo: columns[0]?.id }];
    const map = new Map<string, { id: string; label: string; dot: string | null; rows: Row[]; addTo?: string; rank: number }>();
    const ensure = (id: string, label: string, rank: number, dot: string | null = null, addTo?: string) => {
      if (!map.has(id)) map.set(id, { id, label, dot, rows: [], addTo, rank });
      return map.get(id)!;
    };
    if (groupBy === "status") {
      columns.forEach((column, index) =>
        ensure(column.id, column.name, index, STATUS_TONE[toneFor(column)].dot, column.id),
      );
    }
    for (const row of rows) {
      if (groupBy === "status") ensure(row.column?.id ?? "?", row.column?.name ?? "Other", 99).rows.push(row);
      else if (groupBy === "project")
        ensure(row.task.projectId, row.task.projectName ?? "Project", 0).rows.push(row);
      else if (groupBy === "priority")
        ensure(row.task.priority, PRIORITY_MARK[row.task.priority].label, PRIORITY_RANK[row.task.priority]).rows.push(row);
      else {
        const name = row.people[0]?.name;
        ensure(name ?? "__none__", name ?? "Unassigned", name ? 0 : 1).rows.push(row);
      }
    }
    return [...map.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
  }, [groupBy, rows, columns]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current?.key !== key ? { key, dir: 1 } : current.dir === 1 ? { key, dir: -1 } : null,
    );
  }

  function toggleColumn(key: ColumnKey) {
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const header = (
    <div
      style={gridStyle}
      className="sticky top-0 z-10 hidden items-center gap-3 rounded-xl bg-muted/80 px-3 py-2 text-[11px] font-bold tracking-[0.08em] text-muted-foreground backdrop-blur md:grid md:grid-cols-(--cols)"
    >
      <SortHeader sort={sort} sortKey="title" label="Task" onSort={toggleSort} />
      {shownColumns.map((column) => (
        <SortHeader
          key={column.key}
          sort={sort}
          sortKey={column.key}
          label={column.key === "comments" ? "" : column.label}
          icon={column.key === "comments" ? <MessageSquare className="size-3.5" aria-label="Comments" /> : null}
          className={column.key === "comments" ? "justify-self-end" : undefined}
          onSort={toggleSort}
        />
      ))}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-3 sm:px-6">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <Layers className="size-3.5" />
            {groupBy === "none" ? "Group" : `Group: ${GROUPS.find((row) => row.key === groupBy)?.label}`}
            <ChevronDown className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuRadioGroup value={groupBy} onValueChange={(value) => setGroupBy(value as GroupKey)}>
              <DropdownMenuLabel>Group by</DropdownMenuLabel>
              {GROUPS.filter((row) => showProject || row.key !== "project").map((row) => (
                <DropdownMenuRadioItem key={row.key} value={row.key} closeOnClick>
                  {row.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <Columns3 className="size-3.5" />
            Columns
            <ChevronDown className="size-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {COLUMNS.filter((column) => showProject || column.key !== "project").map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visible.has(column.key)}
                  onCheckedChange={() => toggleColumn(column.key)}
                  closeOnClick={false}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {sort ? (
          <button
            type="button"
            onClick={() => setSort(null)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Clear sort
          </button>
        ) : null}
        {canWrite && columns[0] ? (
          <Button size="sm" className="ml-auto gap-1.5" onClick={() => onAddCard(columns[0].id)}>
            <Plus className="size-3.5" />
            New card
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6 sm:px-6">
        {header}
        {rows.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground ring-1 ring-foreground/8">
            No cards match these filters.
          </p>
        ) : (
          <div className="mt-2 grid gap-3">
            {groups.map((group) => {
              const open = groupBy === "none" || !collapsed.has(group.id);
              return (
                <section
                  key={group.id}
                  className="overflow-hidden rounded-2xl bg-card/60 ring-1 ring-foreground/8"
                >
                  {groupBy !== "none" ? (
                    <header className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <ChevronRight
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            open && "rotate-90",
                          )}
                        />
                        {group.dot ? (
                          <span className={cn("size-2.5 shrink-0 rounded-full", group.dot)} aria-hidden />
                        ) : null}
                        <h2 className="truncate text-[13px] font-semibold text-foreground/85">
                          {group.label}
                        </h2>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                          {group.rows.length}
                        </span>
                      </button>
                      {canWrite && group.addTo ? (
                        <button
                          type="button"
                          onClick={() => onAddCard(group.addTo!)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Plus className="size-3.5" />
                          Add
                        </button>
                      ) : null}
                    </header>
                  ) : null}
                  {open ? (
                    group.rows.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-muted-foreground">Nothing here.</p>
                    ) : (
                      <ul className="divide-y divide-border/40">
                        {group.rows.map((row) => (
                          <TaskRow
                            key={row.task.id}
                            row={row}
                            columns={columns}
                            shownColumns={shownColumns}
                            gridStyle={gridStyle}
                            milestone={taskMilestoneRefs[row.task.id]}
                            canWrite={canWrite}
                            selected={selectedTaskId === row.task.id}
                            onOpen={() => onOpenTask(row.task.id)}
                            onMove={(columnId) => onMove(row.task.id, columnId)}
                          />
                        ))}
                      </ul>
                    )
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SortHeader({
  sort,
  sortKey,
  label,
  icon,
  className,
  onSort,
}: {
  sort: { key: SortKey; dir: 1 | -1 } | null;
  sortKey: SortKey;
  label: string;
  icon?: ReactNode;
  className?: string;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  const Icon = sort?.dir === -1 ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 text-left uppercase hover:text-foreground",
        active && "text-foreground",
        className,
      )}
    >
      {icon}
      {label ? <span className="truncate">{label}</span> : null}
      {active ? <Icon className="size-3 shrink-0" /> : null}
    </button>
  );
}

function StatusBadge({
  column,
  columns,
  canWrite,
  onMove,
}: {
  column: BoardColumn | undefined;
  columns: BoardColumn[];
  canWrite: boolean;
  onMove: (columnId: string) => void;
}) {
  const tone = STATUS_TONE[toneFor(column)];
  const badge = (
    <>
      <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
      <span className="truncate">{column?.name ?? "—"}</span>
    </>
  );
  const badgeClass = cn(
    "inline-flex max-w-full items-center gap-1.5 text-xs font-medium",
    tone.text,
  );
  if (!canWrite) return <span className={badgeClass}>{badge}</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Status: ${column?.name ?? "none"}. Change status`}
        className={cn(badgeClass, "cursor-pointer outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/30")}
      >
        {badge}
        <ChevronDown className="size-3 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {columns.map((option) => (
            <DropdownMenuItem key={option.id} onClick={() => option.id !== column?.id && onMove(option.id)}>
              <span className={cn("size-2 rounded-full", STATUS_TONE[toneFor(option)].dot)} aria-hidden />
              <span className="flex-1 truncate">{option.name}</span>
              {option.id === column?.id ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskRow({
  row,
  columns,
  shownColumns,
  gridStyle,
  milestone,
  canWrite,
  selected,
  onOpen,
  onMove,
}: {
  row: Row;
  columns: BoardColumn[];
  shownColumns: typeof COLUMNS;
  gridStyle: CSSProperties;
  milestone?: { code: string; label: string };
  canWrite: boolean;
  selected: boolean;
  onOpen: () => void;
  onMove: (columnId: string) => void;
}) {
  const { task, people } = row;
  const overdue = isOverdue(task.dueOn);
  const dash = <span className="text-xs text-muted-foreground">—</span>;

  const cell = (key: ColumnKey) => {
    switch (key) {
      case "project":
        return task.projectName ? <ProjectChip label={task.projectName} /> : dash;
      case "status":
        return <StatusBadge column={row.column} columns={columns} canWrite={canWrite} onMove={onMove} />;
      case "assignee":
        return people.length > 0 ? <AvatarStack people={people} size="sm" max={3} /> : dash;
      case "priority":
        return <PriorityMark priority={task.priority} />;
      case "due":
        return task.dueOn ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
              overdue ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
            )}
          >
            <CalendarDays className="size-3 opacity-80" />
            {formatDay(task.dueOn)}
          </span>
        ) : (
          dash
        );
      case "milestone":
        return milestone ? <StatusChip tone="planning">{milestone.label}</StatusChip> : dash;
      case "labels":
        return task.labels.length ? (
          <span className="flex min-w-0 gap-1">
            {task.labels.slice(0, 2).map((label) => (
              <ProjectChip key={label} label={label} className="max-w-20" />
            ))}
            {task.labels.length > 2 ? (
              <span className="text-[11px] text-muted-foreground">+{task.labels.length - 2}</span>
            ) : null}
          </span>
        ) : (
          dash
        );
      case "comments":
        return task.commentCount > 0 ? (
          <span className="inline-flex items-center justify-end gap-1 text-xs font-medium tabular-nums text-muted-foreground">
            <MessageSquare className="size-3" />
            {task.commentCount}
          </span>
        ) : null;
    }
  };

  return (
    <li
      style={gridStyle}
      onClick={onOpen}
      className={cn(
        "group/row grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-3 py-2 transition-colors hover:bg-muted/50 md:grid-cols-(--cols)",
        selected && "bg-primary/8 hover:bg-primary/10",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {task.kind !== "task" ? <KindMark kind={task.kind} showLabel /> : null}
        <button
          type="button"
          className="min-w-0 truncate text-left text-sm font-medium leading-6 hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          {task.title}
        </button>
        <CopyTaskLinkIcon
          taskId={task.id}
          className="shrink-0 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:hidden"
        />
      </div>
      {shownColumns.map((column) => (
        <div
          key={column.key}
          onClick={column.key === "status" ? (event) => event.stopPropagation() : undefined}
          className={cn(
            "min-w-0",
            column.key === "status" ? "justify-self-end md:justify-self-start" : "hidden md:block",
            column.key === "comments" && "text-right",
          )}
        >
          {cell(column.key)}
        </div>
      ))}
    </li>
  );
}
