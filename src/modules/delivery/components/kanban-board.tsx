"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BoardCanvas,
  BoardColumn as SoftBoardLane,
  boardCollisionDetection,
  useBoardDndSensors,
} from "@/components/studio/board";
import { AvatarFilterStack } from "@/components/studio/avatar-mark";
import { MobileFilters } from "@/components/studio/mobile-filters";
import type { MentionItem } from "@/components/editor/rich-editor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  createColumnAction,
  deleteColumnAction,
  moveTaskAction,
  renameColumnAction,
  reorderColumnsAction,
  updateTaskStatusAction,
} from "@/modules/delivery/actions";
import {
  TaskBoardCard,
  TaskDragHandle,
} from "@/modules/delivery/components/task-board-card";
import {
  TaskModal,
  type TaskModalProject,
  type TaskModalState,
} from "@/modules/delivery/components/task-modal";
import type {
  BoardColumn,
  BoardTask,
  TaskAssigneeOption,
  TaskComment,
  TaskPriority,
  TaskStatus,
} from "@/modules/delivery/types";

export type { TaskAssigneeOption };

const PRIORITY_TABS: {
  value: "" | TaskPriority;
  label: string;
  activeClass: string;
}[] = [
  { value: "", label: "All", activeClass: "bg-slate-900 text-white shadow-sm" },
  {
    value: "high",
    label: "H",
    activeClass: "bg-rose-600 text-white shadow-sm",
  },
  {
    value: "medium",
    label: "M",
    activeClass: "bg-amber-500 text-white shadow-sm",
  },
  {
    value: "low",
    label: "L",
    activeClass: "bg-sky-600 text-white shadow-sm",
  },
];

const ORG_LANES: BoardColumn[] = [
  { id: "lane:todo", projectId: "__org__", name: "To do", position: 0, systemKey: "todo" },
  { id: "lane:doing", projectId: "__org__", name: "Doing", position: 1, systemKey: "doing" },
  { id: "lane:done", projectId: "__org__", name: "Done", position: 2, systemKey: "done" },
];

const LANE_DOT: Record<string, string> = {
  "lane:todo": "bg-slate-400",
  "lane:doing": "bg-sky-500",
  "lane:done": "bg-emerald-500",
};

function laneIdForStatus(status: TaskStatus) {
  return `lane:${status}` as const;
}

function statusFromLaneId(laneId: string): TaskStatus | null {
  if (laneId === "lane:todo") return "todo";
  if (laneId === "lane:doing") return "doing";
  if (laneId === "lane:done") return "done";
  return null;
}

function groupTasks(columns: BoardColumn[], tasks: BoardTask[], useStatusLanes: boolean) {
  const firstId = columns[0]?.id ?? null;
  const map = new Map<string, BoardTask[]>();
  for (const column of columns) map.set(column.id, []);
  for (const task of [...tasks].sort((a, b) => a.position - b.position)) {
    const key = useStatusLanes
      ? laneIdForStatus(task.status)
      : task.columnId && map.has(task.columnId)
        ? task.columnId
        : firstId;
    if (key) map.get(key)?.push(task);
  }
  return map;
}

export function KanbanBoard({
  orgSlug,
  projectId,
  scope = "project",
  columns: projectColumns,
  columnsByProject = {},
  tasks,
  milestones = [],
  milestonesByProject = {},
  taskMilestoneRefs = {},
  comments,
  canWrite,
  currentUserId,
  assignees = [],
  projects = [],
  className,
}: {
  orgSlug: string;
  projectId?: string;
  scope?: "project" | "org";
  columns?: BoardColumn[];
  columnsByProject?: Record<string, BoardColumn[]>;
  tasks: BoardTask[];
  milestones?: { id: string; name: string }[];
  milestonesByProject?: Record<string, { id: string; name: string }[]>;
  taskMilestoneRefs?: Record<string, { code: string; label: string }>;
  comments: TaskComment[];
  canWrite: boolean;
  currentUserId: string;
  assignees?: TaskAssigneeOption[];
  projects?: TaskModalProject[];
  className?: string;
}) {
  const router = useRouter();
  const orgMode = scope === "org";
  const [filterProject, setFilterProject] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterAssignees, setFilterAssignees] = useState<Set<string>>(() => new Set());
  const [filterPriority, setFilterPriority] = useState<"" | TaskPriority>("");

  // All-projects org board → status lanes. Single project (org filter or project page) → real lists.
  const useStatusLanes = orgMode && !filterProject;
  const columns = useMemo(() => {
    if (!orgMode) return projectColumns ?? [];
    if (filterProject) return columnsByProject[filterProject] ?? [];
    return ORG_LANES;
  }, [orgMode, projectColumns, filterProject, columnsByProject]);
  const resolvedProjectId = projectId || filterProject || "";
  const manageLists = Boolean(resolvedProjectId) && !useStatusLanes;

  const [, start] = useTransition();
  const [orderedColumns, setOrderedColumns] = useState(columns);
  const [items, setItems] = useState(() => groupTasks(columns, tasks, useStatusLanes));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [activeHeight, setActiveHeight] = useState(76);
  const [modal, setModal] = useState<TaskModalState | null>(null);
  const sensors = useBoardDndSensors();

  const filteredTasks = useMemo(() => {
    if (!orgMode) return tasks;
    return tasks.filter((task) => {
      if (filterProject && task.projectId !== filterProject) return false;
      if (filterClient && task.clientId !== filterClient) return false;
      if (filterAssignees.size > 0) {
        const ids = task.assigneeUserIds?.length
          ? task.assigneeUserIds
          : task.assigneeUserId
            ? [task.assigneeUserId]
            : [];
        if (!ids.some((id) => filterAssignees.has(id))) return false;
      }
      if (filterPriority && task.priority !== filterPriority) return false;
      return true;
    });
  }, [orgMode, tasks, filterProject, filterClient, filterAssignees, filterPriority]);

  function toggleAssigneeFilter(userId: string) {
    setFilterAssignees((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  useEffect(() => {
    setOrderedColumns(columns);
    setItems(groupTasks(columns, filteredTasks, useStatusLanes));
  }, [columns, filteredTasks, useStatusLanes]);

  const columnMap = useMemo(
    () => new Map(orderedColumns.map((column) => [column.id, column])),
    [orderedColumns],
  );
  const assigneeById = useMemo(
    () =>
      new Map(
        assignees.map((row) => [
          row.userId,
          { label: row.label, avatarUrl: row.avatarUrl ?? null },
        ] as const),
      ),
    [assignees],
  );
  const overlayTask = activeId ? filteredTasks.find((task) => task.id === activeId) : null;
  const overlayColumn =
    activeId && !overlayTask ? columnMap.get(activeId) ?? null : null;

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (task.clientId && task.clientName) map.set(task.clientId, task.clientName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [tasks]);

  function columnOf(taskId: string) {
    for (const [columnId, list] of items) {
      if (list.some((task) => task.id === taskId)) return columnId;
    }
    return null;
  }

  function resolveColumnId(overId: string) {
    if (columnMap.has(overId)) return overId;
    return columnOf(overId);
  }

  function resolveDropIndex(activeTaskId: string, columnId: string, overId: string) {
    const list = items.get(columnId) ?? [];
    const visible = list.filter((task) => task.id !== activeTaskId);
    if (columnMap.has(overId)) return visible.length;
    const overVisible = visible.findIndex((task) => task.id === overId);
    return overVisible < 0 ? visible.length : overVisible;
  }

  function onDragEnd(event: DragEndEvent) {
    const draggedId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const type = (event.active.data.current?.type as "task" | "column" | undefined) ?? null;
    setActiveId(null);
    setOverColumnId(null);
    setDropIndex(null);
    if (!overId || !canWrite) return;

    if (type === "column") {
      if (!manageLists) return;
      const overColumnId = resolveColumnId(overId);
      if (!overColumnId || draggedId === overColumnId) return;
      const oldIndex = orderedColumns.findIndex((column) => column.id === draggedId);
      const newIndex = orderedColumns.findIndex((column) => column.id === overColumnId);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(orderedColumns, oldIndex, newIndex);
      setOrderedColumns(next);
      start(async () => {
        const result = await reorderColumnsAction(
          orgSlug,
          resolvedProjectId,
          next.map((column) => column.id),
        );
        if (result.error) {
          toast.error(result.error);
          setOrderedColumns(columns);
          return;
        }
        router.refresh();
      });
      return;
    }

    const fromColumn = columnOf(draggedId);
    const overColumn = resolveColumnId(overId);
    if (!fromColumn || !overColumn) return;

    const fromList = items.get(fromColumn) ?? [];
    const toList = items.get(overColumn) ?? [];
    const fromIndex = fromList.findIndex((task) => task.id === draggedId);
    if (fromIndex < 0) return;

    const next = new Map(items);
    if (fromColumn === overColumn) {
      const overIndex = toList.findIndex((task) => task.id === overId);
      const target = overIndex < 0 ? fromIndex : overIndex;
      next.set(fromColumn, arrayMove(fromList, fromIndex, target));
    } else {
      const moving = fromList[fromIndex];
      const remaining = fromList.filter((task) => task.id !== draggedId);
      const overIndex = toList.findIndex((task) => task.id === overId);
      const status = useStatusLanes ? statusFromLaneId(overColumn) : null;
      const inserted = [...toList];
      inserted.splice(overIndex < 0 ? inserted.length : overIndex, 0, {
        ...moving,
        columnId: useStatusLanes ? moving.columnId : overColumn,
        ...(status ? { status } : {}),
      });
      next.set(fromColumn, remaining);
      next.set(overColumn, inserted);
    }
    setItems(next);

    const orderedIds = (next.get(overColumn) ?? []).map((task) => task.id);
    start(async () => {
      if (useStatusLanes) {
        const status = statusFromLaneId(overColumn);
        if (!status) return;
        const result = await updateTaskStatusAction(orgSlug, draggedId, status);
        if (result.error) {
          toast.error(result.error);
          setItems(groupTasks(columns, filteredTasks, useStatusLanes));
          return;
        }
      } else {
        const result = await moveTaskAction(orgSlug, draggedId, overColumn, orderedIds);
        if (result.error) {
          toast.error(result.error);
          setItems(groupTasks(columns, filteredTasks, useStatusLanes));
          return;
        }
      }
      router.refresh();
    });
  }

  const mentions: MentionItem[] = useMemo(
    () => [
      ...milestones.map((item) => ({
        id: item.id,
        label: item.name,
        type: "milestone" as const,
      })),
      ...filteredTasks.map((item) => ({
        id: item.id,
        label: item.title,
        type: "task" as const,
      })),
    ],
    [milestones, filteredTasks],
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {orgMode ? (
        <div className="flex shrink-0 items-center border-b border-border/40 px-3 py-2 sm:px-5 sm:py-2.5">
          <MobileFilters
            title="Board filters"
            description="Narrow cards by project or client."
            activeCount={[filterProject, filterClient].filter(Boolean).length}
            className="shrink-0"
            triggerClassName="h-8"
          >
            <div className="space-y-3">
              <NativeSelect
                value={filterProject}
                onChange={(event) => setFilterProject(event.target.value)}
                className="h-9 w-full rounded-xl bg-muted text-sm"
              >
                <option value="">All projects (by status)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                value={filterClient}
                onChange={(event) => setFilterClient(event.target.value)}
                className="h-9 w-full rounded-xl bg-muted text-sm"
              >
                <option value="">All clients</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </MobileFilters>

          <div className="ml-4 flex min-w-0 flex-1 items-center gap-3 sm:ml-5 sm:gap-3.5">
            <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex">
              <NativeSelect
                value={filterProject}
                onChange={(event) => setFilterProject(event.target.value)}
                className="h-9 w-48 rounded-xl bg-muted text-sm"
              >
                <option value="">All projects (by status)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                value={filterClient}
                onChange={(event) => setFilterClient(event.target.value)}
                className="h-9 w-44 rounded-xl bg-muted text-sm"
              >
                <option value="">All clients</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {assignees.length > 0 ? (
              <AvatarFilterStack
                people={assignees.map((member) => ({
                  id: member.userId,
                  name: member.label,
                  src: member.avatarUrl,
                }))}
                selectedIds={filterAssignees}
                onToggle={toggleAssigneeFilter}
                size="sm"
              />
            ) : null}

            <NativeSelect
              value={filterPriority}
              onChange={(event) =>
                setFilterPriority(event.target.value as "" | TaskPriority)
              }
              aria-label="Filter by priority"
              className="h-8 w-[6.5rem] shrink-0 rounded-lg bg-muted/80 text-xs md:hidden"
            >
              <option value="">Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </NativeSelect>

            <div
              role="tablist"
              aria-label="Filter by priority"
              className="hidden items-center gap-0.5 rounded-xl bg-muted/80 p-1 ring-1 ring-foreground/6 md:inline-flex dark:bg-muted/50"
            >
              {PRIORITY_TABS.map((tab) => {
                const active = filterPriority === tab.value;
                return (
                  <button
                    key={tab.value || "all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    title={
                      tab.value === ""
                        ? "All priorities"
                        : tab.value === "high"
                          ? "High"
                          : tab.value === "medium"
                            ? "Medium"
                            : "Low"
                    }
                    onClick={() => setFilterPriority(tab.value)}
                    className={cn(
                      "min-w-8 rounded-lg px-2.5 py-1.5 text-sm font-bold transition-colors duration-150",
                      active
                        ? tab.activeClass
                        : "text-muted-foreground hover:bg-card hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <p className="ml-auto shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
              {filteredTasks.length}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={boardCollisionDetection}
          measuring={{
            droppable: { strategy: MeasuringStrategy.Always },
          }}
          onDragStart={({ active }) => {
            setActiveId(String(active.id));
            const height = active.rect.current.initial?.height;
            setActiveHeight(height && height > 0 ? Math.round(height) : 76);
          }}
          onDragOver={({ active, over }) => {
            if (!over || active.data.current?.type === "column") {
              setOverColumnId(null);
              setDropIndex(null);
              return;
            }
            const activeTaskId = String(active.id);
            const overId = String(over.id);
            const columnId = resolveColumnId(overId);
            if (!columnId) {
              setOverColumnId(null);
              setDropIndex(null);
              return;
            }
            setOverColumnId(columnId);

            let index = resolveDropIndex(activeTaskId, columnId, overId);
            // Place after the hovered card when the pointer is in its lower half.
            if (!columnMap.has(overId) && over.rect && active.rect.current.translated) {
              const pointerMid =
                active.rect.current.translated.top +
                active.rect.current.translated.height / 2;
              const overMid = over.rect.top + over.rect.height / 2;
              if (pointerMid > overMid) index += 1;
            }
            const list = items.get(columnId) ?? [];
            const max = list.filter((task) => task.id !== activeTaskId).length;
            setDropIndex(Math.max(0, Math.min(index, max)));
          }}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOverColumnId(null);
            setDropIndex(null);
          }}
        >
          <BoardCanvas className="h-full min-h-0 px-3 pb-3 pt-3 sm:px-4">
            <SortableContext
              items={orderedColumns.map((column) => column.id)}
              strategy={horizontalListSortingStrategy}
            >
              {orderedColumns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  orgSlug={orgSlug}
                  statusLanes={useStatusLanes}
                  manageLists={manageLists}
                  column={column}
                  tasks={items.get(column.id) ?? []}
                  taskMilestoneRefs={taskMilestoneRefs}
                  assigneeLabelById={assigneeById}
                  canWrite={canWrite}
                  canManageColumns={manageLists && orderedColumns.length > 1}
                  selectedTaskId={modal?.mode === "edit" ? modal.taskId : null}
                  activeTaskId={activeId}
                  dropActive={Boolean(activeId) && overColumnId === column.id}
                  dropIndex={
                    Boolean(activeId) && overColumnId === column.id ? dropIndex : null
                  }
                  dropHeight={activeHeight}
                  showProject={orgMode}
                  onOpenTask={(taskId) => setModal({ mode: "edit", taskId })}
                  onAddCard={() =>
                    setModal({
                      mode: "create",
                      columnId: useStatusLanes ? null : column.id,
                      status: useStatusLanes
                        ? (statusFromLaneId(column.id) ?? "todo")
                        : undefined,
                      projectId: filterProject || projects[0]?.id || resolvedProjectId,
                    })
                  }
                />
              ))}
            </SortableContext>
            {canWrite && manageLists ? (
              <AddColumn orgSlug={orgSlug} projectId={resolvedProjectId} />
            ) : null}
          </BoardCanvas>
          {typeof document !== "undefined"
            ? createPortal(
                <DragOverlay adjustScale={false} dropAnimation={null}>
                  {overlayTask ? (
                    <div className="w-74 cursor-grabbing">
                      <TaskBoardCard
                        title={overlayTask.title}
                        description={overlayTask.description}
                        priority={overlayTask.priority}
                        kind={overlayTask.kind}
                        labels={overlayTask.labels}
                        dueOn={overlayTask.dueOn}
                        projectLabel={overlayTask.projectName}
                        clientLabel={overlayTask.clientName}
                        people={
                          (overlayTask.assigneeUserIds?.length
                            ? overlayTask.assigneeUserIds
                            : overlayTask.assigneeUserId
                              ? [overlayTask.assigneeUserId]
                              : []
                          ).map((userId, index) => ({
                            name:
                              overlayTask.assigneeLabels?.[index] ??
                              assigneeById.get(userId)?.label ??
                              "Assignee",
                            src: assigneeById.get(userId)?.avatarUrl,
                          }))
                        }
                        commentCount={overlayTask.commentCount}
                        className="shadow-lift ring-primary/30"
                      />
                    </div>
                  ) : null}
                  {overlayColumn ? (
                    <div className="flex w-80 cursor-grabbing items-center gap-2 rounded-[1.75rem] bg-muted/90 px-3.5 py-3 shadow-soft ring-1 ring-border/40">
                      <DragHandleDots className="opacity-60" />
                      <p className="text-[15px] font-semibold">{overlayColumn.name}</p>
                    </div>
                  ) : null}
                </DragOverlay>,
                document.body,
              )
            : null}
        </DndContext>
      </div>

      <TaskModal
        orgSlug={orgSlug}
        open={Boolean(modal)}
        state={modal}
        tasks={tasks}
        comments={comments}
        milestones={milestones}
        milestonesByProject={milestonesByProject}
        projects={projects}
        assignees={assignees}
        mentions={mentions}
        currentUserId={currentUserId}
        canWrite={canWrite}
        showProjectPicker={orgMode}
        onClose={() => setModal(null)}
      />
    </div>
  );
}

function KanbanColumn({
  orgSlug,
  statusLanes,
  manageLists,
  column,
  tasks,
  taskMilestoneRefs,
  assigneeLabelById,
  canWrite,
  canManageColumns,
  selectedTaskId,
  activeTaskId,
  dropActive,
  dropIndex,
  dropHeight,
  showProject,
  onOpenTask,
  onAddCard,
}: {
  orgSlug: string;
  statusLanes: boolean;
  manageLists: boolean;
  column: BoardColumn;
  tasks: BoardTask[];
  taskMilestoneRefs: Record<string, { code: string; label: string }>;
  assigneeLabelById: Map<string, { label: string; avatarUrl: string | null }>;
  canWrite: boolean;
  canManageColumns: boolean;
  selectedTaskId?: string | null;
  activeTaskId?: string | null;
  dropActive?: boolean;
  dropIndex?: number | null;
  dropHeight?: number;
  showProject?: boolean;
  onOpenTask: (id: string) => void;
  onAddCard: () => void;
}) {
  const router = useRouter();
  const [pendingRename, startRename] = useTransition();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: column.id,
    data: { type: "column" as const },
    disabled: {
      draggable: !manageLists || !canWrite,
      droppable: !canWrite,
    },
  });

  let visibleIndex = 0;

  return (
    <SoftBoardLane
      id={column.id}
      setNodeRef={setNodeRef}
      isOver={dropActive || isOver}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(isDragging && "opacity-40")}
      header={
        <header className="flex shrink-0 items-center gap-1.5 px-2.5 py-2.5">
          {manageLists && canWrite ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              className="inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground active:cursor-grabbing"
              aria-label={`Drag ${column.name} column`}
              {...attributes}
              {...listeners}
            >
              <DragHandleDots />
            </button>
          ) : statusLanes ? (
            <span
              className={cn("ml-1 size-2.5 shrink-0 rounded-full", LANE_DOT[column.id])}
              aria-hidden
            />
          ) : null}
          {manageLists && canWrite ? (
            <input
              defaultValue={column.name}
              disabled={pendingRename}
              className="min-w-0 flex-1 bg-transparent px-1 text-[12px] font-bold tracking-[0.08em] text-foreground/70 uppercase outline-none"
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (!name || name === column.name) return;
                startRename(async () => {
                  const data = new FormData();
                  data.set("name", name);
                  const result = await renameColumnAction(orgSlug, column.id, data);
                  if (result.error) toast.error(result.error);
                  else router.refresh();
                });
              }}
            />
          ) : (
            <h2 className="flex-1 px-1 text-[12px] font-bold tracking-[0.08em] text-foreground/70 uppercase">
              {column.name}
            </h2>
          )}
          <span className="rounded-md bg-card px-2.5 py-1 text-xs font-bold tabular-nums text-muted-foreground shadow-sm ring-1 ring-white/10">
            {tasks.length}
          </span>
          {manageLists && canWrite && canManageColumns ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" aria-label="Column" />}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Delete this column? Cards move to the first remaining list.",
                      )
                    ) {
                      return;
                    }
                    startRename(async () => {
                      const result = await deleteColumnAction(orgSlug, column.id);
                      if (result.error) toast.error(result.error);
                      else router.refresh();
                    });
                  }}
                >
                  Delete column
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </header>
      }
      footer={
        canWrite ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            onClick={onAddCard}
          >
            <Plus className="size-4" />
            Add a card
          </button>
        ) : null
      }
    >
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => {
          const assigneeIds = task.assigneeUserIds?.length
            ? task.assigneeUserIds
            : task.assigneeUserId
              ? [task.assigneeUserId]
              : [];
          const people = assigneeIds.map((userId, index) => {
            const fromMap = assigneeLabelById.get(userId);
            return {
              name:
                task.assigneeLabels?.[index] ??
                fromMap?.label ??
                task.assigneeLabel ??
                "Assignee",
              src: fromMap?.avatarUrl ?? null,
            };
          });
          const isActive = Boolean(activeTaskId && task.id === activeTaskId);
          const showSlot =
            dropActive && dropIndex != null && !isActive && dropIndex === visibleIndex;
          if (!isActive) visibleIndex += 1;

          return (
            <div key={task.id} className="contents">
              {showSlot ? <DropSlot height={dropHeight ?? 76} /> : null}
              <SortableCard
                task={task}
                milestoneRef={taskMilestoneRefs[task.id]}
                people={people}
                showProject={showProject}
                selected={selectedTaskId === task.id}
                disabled={!canWrite}
                collapsed={isActive}
                onOpen={() => onOpenTask(task.id)}
              />
            </div>
          );
        })}
        {dropActive && dropIndex != null && dropIndex >= visibleIndex ? (
          <DropSlot height={dropHeight ?? 76} />
        ) : null}
      </SortableContext>
      {tasks.length === 0 && !dropActive ? (
        <p className="px-2 py-8 text-center text-sm font-medium text-muted-foreground">
          Drop cards here
        </p>
      ) : null}
    </SoftBoardLane>
  );
}

function DropSlot({ height }: { height: number }) {
  return (
    <div
      className="shrink-0 rounded-xl border-2 border-dashed border-primary/45 bg-primary/8"
      style={{ height }}
      aria-hidden
    />
  );
}

function DragHandleDots({ className }: { className?: string }) {
  return (
    <span className={cn("grid grid-cols-2 gap-0.75", className)} aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} className="size-1 rounded-[1px] bg-current" />
      ))}
    </span>
  );
}

function SortableCard({
  task,
  milestoneRef,
  people,
  showProject,
  selected,
  disabled,
  collapsed,
  onOpen,
}: {
  task: BoardTask;
  milestoneRef?: { code: string; label: string };
  people: { name: string; src?: string | null }[];
  showProject?: boolean;
  selected?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task" as const },
    disabled,
    animateLayoutChanges: () => false,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: collapsed || isDragging ? undefined : CSS.Translate.toString(transform),
        transition: collapsed || isDragging ? undefined : transition,
      }}
      className={cn(
        "list-none",
        (collapsed || isDragging) &&
          "pointer-events-none m-0 h-0 min-h-0 overflow-hidden border-0 p-0 opacity-0",
      )}
      {...attributes}
      {...listeners}
    >
      <TaskBoardCard
        title={task.title}
        description={task.description}
        priority={task.priority}
        kind={task.kind}
        labels={task.labels}
        dueOn={task.dueOn}
        milestoneLabel={milestoneRef?.label}
        projectLabel={showProject ? task.projectName : undefined}
        clientLabel={showProject ? task.clientName : undefined}
        people={people}
        commentCount={task.commentCount}
        selected={selected}
        onOpen={onOpen}
        dragHandle={disabled ? null : <TaskDragHandle />}
      />
    </li>
  );
}

function AddColumn({ orgSlug, projectId }: { orgSlug: string; projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex w-80 shrink-0 flex-col self-start lane-inset p-2.5">
      {open ? (
        <form
          className="flex flex-col gap-2 p-1"
          action={(formData) => {
            start(async () => {
              const result = await createColumnAction(orgSlug, projectId, formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <Input name="name" required placeholder="List name" autoFocus />
          <div className="flex justify-end gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Adding…" : "Add list"}
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-card/70 hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" />
          Add a list
        </button>
      )}
    </div>
  );
}
