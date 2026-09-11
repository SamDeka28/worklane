"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare, MoreHorizontal, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { AvatarMark } from "@/components/studio/chrome";
import { BoardCanvas, BoardColumn as SoftBoardLane } from "@/components/studio/board";
import { Field } from "@/components/studio/field";
import { StatusChip } from "@/components/studio/status-chip";
import {
  HiddenDocFields,
  RichEditor,
  type MentionItem,
} from "@/components/editor/rich-editor";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addTaskCommentAction,
  createColumnAction,
  createTaskAction,
  deleteColumnAction,
  deleteTaskAction,
  moveTaskAction,
  renameColumnAction,
  reorderColumnsAction,
  updateTaskAction,
} from "@/modules/delivery/actions";
import { formatDay } from "@/modules/finance/presentation";
import type { BoardColumn, TaskComment, TaskRecord } from "@/modules/delivery/types";

export type TaskAssigneeOption = {
  userId: string;
  label: string;
};
const PRIORITY_TONE = {
  low: "planning",
  medium: "hourly",
  high: "overdue",
} as const;

function groupTasks(columns: BoardColumn[], tasks: TaskRecord[]) {
  const firstId = columns[0]?.id ?? null;
  const map = new Map<string, TaskRecord[]>();
  for (const column of columns) map.set(column.id, []);
  for (const task of [...tasks].sort((a, b) => a.position - b.position)) {
    const key = task.columnId && map.has(task.columnId) ? task.columnId : firstId;
    if (key) map.get(key)?.push(task);
  }
  return map;
}

export function KanbanBoard({
  orgSlug,
  projectId,
  columns,
  tasks,
  milestones,
  taskMilestoneRefs = {},
  comments,
  canWrite,
  currentUserId,
  assignees = [],
}: {
  orgSlug: string;
  projectId: string;
  columns: BoardColumn[];
  tasks: TaskRecord[];
  milestones: { id: string; name: string }[];
  taskMilestoneRefs?: Record<string, { code: string; label: string }>;
  comments: TaskComment[];
  canWrite: boolean;
  currentUserId: string;
  assignees?: TaskAssigneeOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [orderedColumns, setOrderedColumns] = useState(columns);
  const [items, setItems] = useState(() => groupTasks(columns, tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"task" | "column" | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setOrderedColumns(columns);
    setItems(groupTasks(columns, tasks));
  }, [columns, tasks]);

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const columnMap = useMemo(
    () => new Map(orderedColumns.map((column) => [column.id, column])),
    [orderedColumns],
  );
  const assigneeLabelById = useMemo(
    () => new Map(assignees.map((row) => [row.userId, row.label] as const)),
    [assignees],
  );
  const overlayTask = activeType === "task" && activeId ? taskMap.get(activeId) : null;
  const overlayColumn = activeType === "column" && activeId ? columnMap.get(activeId) : null;
  const openTask = openTaskId ? tasks.find((task) => task.id === openTaskId) : null;

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

  function onDragEnd(event: DragEndEvent) {
    const draggedId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const type = (event.active.data.current?.type as "task" | "column" | undefined) ?? null;
    setActiveId(null);
    setActiveType(null);
    if (!overId || !canWrite) return;

    if (type === "column") {
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
          projectId,
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
      const inserted = [...toList];
      inserted.splice(overIndex < 0 ? inserted.length : overIndex, 0, {
        ...moving,
        columnId: overColumn,
      });
      next.set(fromColumn, remaining);
      next.set(overColumn, inserted);
    }
    setItems(next);

    const orderedIds = (next.get(overColumn) ?? []).map((task) => task.id);
    start(async () => {
      const result = await moveTaskAction(orgSlug, draggedId, overColumn, orderedIds);
      if (result.error) {
        toast.error(result.error);
        setItems(groupTasks(columns, tasks));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => {
          setActiveId(String(active.id));
          setActiveType((active.data.current?.type as "task" | "column" | undefined) ?? "task");
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setActiveType(null);
        }}
      >
        <BoardCanvas className="px-0 pb-0">
          <SortableContext
            items={orderedColumns.map((column) => column.id)}
            strategy={horizontalListSortingStrategy}
          >
            {orderedColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                orgSlug={orgSlug}
                projectId={projectId}
                column={column}
                tasks={items.get(column.id) ?? []}
                taskMilestoneRefs={taskMilestoneRefs}
                assigneeLabelById={assigneeLabelById}
                assignees={assignees}
                canWrite={canWrite}
                canDelete={orderedColumns.length > 1}
                pending={pending}
                onOpenTask={setOpenTaskId}
              />
            ))}
          </SortableContext>
          {canWrite ? <AddColumn orgSlug={orgSlug} projectId={projectId} /> : null}
        </BoardCanvas>
        <DragOverlay>
          {overlayTask ? (
            <div className="flex w-72 items-start gap-2 rounded-2xl bg-card px-3 py-2.5 shadow-soft">
              <DragHandleDots className="mt-1 opacity-60" />
              <p className="text-sm font-medium">{overlayTask.title}</p>
            </div>
          ) : null}
          {overlayColumn ? (
            <div className="flex w-72 items-center gap-2 rounded-3xl bg-muted/90 px-3 py-3 shadow-soft ring-1 ring-border/40">
              <DragHandleDots className="opacity-60" />
              <p className="text-sm font-semibold">{overlayColumn.name}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {openTask ? (
        <TaskSheet
          orgSlug={orgSlug}
          task={openTask}
          milestones={milestones}
          milestoneRef={taskMilestoneRefs[openTask.id]}
          comments={comments.filter((row) => row.taskId === openTask.id)}
          currentUserId={currentUserId}
          canWrite={canWrite}
          assignees={assignees}
          mentions={[
            ...milestones.map((item) => ({
              id: item.id,
              label: item.name,
              type: "milestone",
            })),
            ...tasks.map((item) => ({
              id: item.id,
              label: item.title,
              type: "task",
            })),
          ]}
          onClose={() => setOpenTaskId(null)}
        />
      ) : null}
    </div>
  );
}

function KanbanColumn({
  orgSlug,
  projectId,
  column,
  tasks,
  taskMilestoneRefs,
  assigneeLabelById,
  assignees,
  canWrite,
  canDelete,
  pending,
  onOpenTask,
}: {
  orgSlug: string;
  projectId: string;
  column: BoardColumn;
  tasks: TaskRecord[];
  taskMilestoneRefs: Record<string, { code: string; label: string }>;
  assigneeLabelById: Map<string, string>;
  assignees: TaskAssigneeOption[];
  canWrite: boolean;
  canDelete: boolean;
  pending: boolean;
  onOpenTask: (id: string) => void;
}) {
  const router = useRouter();
  const [pendingRename, startRename] = useTransition();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: column.id,
    data: { type: "column" as const },
    disabled: !canWrite || pending,
  });

  return (
    <SoftBoardLane
      id={column.id}
      setNodeRef={setNodeRef}
      isOver={isOver}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "opacity-40")}
      header={
        <header className="flex shrink-0 items-center gap-1 px-2 py-2">
          {canWrite ? (
            <button
              type="button"
              className="inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
              aria-label={`Drag ${column.name} column`}
              {...attributes}
              {...listeners}
            >
              <DragHandleDots />
            </button>
          ) : null}
          {canWrite ? (
            <input
              defaultValue={column.name}
              disabled={pendingRename}
              className="min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold outline-none"
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
            <h2 className="flex-1 px-1 text-sm font-semibold">{column.name}</h2>
          )}
          <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {tasks.length}
          </span>
          {canWrite && canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Column" />}>
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    if (!window.confirm("Delete this column? Cards move to the first remaining list.")) return;
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
          <AddCard
            orgSlug={orgSlug}
            projectId={projectId}
            columnId={column.id}
            assignees={assignees}
          />
        ) : null
      }
    >
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableCard
            key={task.id}
            task={task}
            milestoneRef={taskMilestoneRefs[task.id]}
            assigneeLabel={
              task.assigneeUserId
                ? assigneeLabelById.get(task.assigneeUserId) ?? null
                : null
            }
            disabled={!canWrite || pending}
            onOpen={() => onOpenTask(task.id)}
          />
        ))}
      </SortableContext>
    </SoftBoardLane>
  );
}

function DragHandleDots({ className }: { className?: string }) {
  return (
    <span
      className={cn("grid grid-cols-2 gap-[3px]", className)}
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} className="size-1 rounded-[1px] bg-current" />
      ))}
    </span>
  );
}

function SortableCard({
  task,
  milestoneRef,
  assigneeLabel,
  disabled,
  onOpen,
}: {
  task: TaskRecord;
  milestoneRef?: { code: string; label: string };
  assigneeLabel?: string | null;
  disabled?: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task" as const },
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl bg-card px-2.5 py-2.5 shadow-sm",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        {!disabled ? (
          <button
            type="button"
            className="mt-0.5 inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label="Drag card"
            {...attributes}
            {...listeners}
          >
            <DragHandleDots />
          </button>
        ) : null}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <p className="text-sm font-medium">{task.title}</p>
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {milestoneRef ? (
              <StatusChip tone="planning">{milestoneRef.label}</StatusChip>
            ) : null}
            <StatusChip tone={PRIORITY_TONE[task.priority]}>{task.priority}</StatusChip>
            {task.dueOn ? (
              <span className="text-[11px] text-muted-foreground">{formatDay(task.dueOn)}</span>
            ) : null}
            {task.commentCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <MessageSquare className="size-3" />
                {task.commentCount}
              </span>
            ) : null}
            {assigneeLabel ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <AvatarMark name={assigneeLabel} size="sm" />
                <span className="max-w-20 truncate">{assigneeLabel}</span>
              </span>
            ) : null}
          </div>
        </button>
      </div>
    </li>
  );
}

function AddCard({
  orgSlug,
  projectId,
  columnId,
  assignees,
}: {
  orgSlug: string;
  projectId: string;
  columnId: string;
  assignees: TaskAssigneeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-card/80 hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" />
        Add a card
      </button>
    );
  }

  return (
    <form
      className="rounded-2xl bg-card p-2 shadow-sm"
      action={(formData) => {
        start(async () => {
          const result = await createTaskAction(orgSlug, projectId, formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Card added");
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="column_id" value={columnId} />
      <Textarea name="title" required placeholder="Card title" className="min-h-16" autoFocus />
      {assignees.length > 0 ? (
        <div className="mt-2">
          <NativeSelect name="assignee_user_id" defaultValue="">
            <option value="">Unassigned</option>
            {assignees.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="mt-2 flex justify-end gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}

function AddColumn({ orgSlug, projectId }: { orgSlug: string; projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-3xl bg-muted/40 p-2">
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
          className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-muted-foreground hover:bg-card/70 hover:text-foreground"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-3.5" />
          Add a list
        </button>
      )}
    </div>
  );
}

function TaskSheet({
  orgSlug,
  task,
  milestones,
  milestoneRef,
  comments,
  currentUserId,
  canWrite,
  assignees,
  mentions,
  onClose,
}: {
  orgSlug: string;
  task: TaskRecord;
  milestones: { id: string; name: string }[];
  milestoneRef?: { code: string; label: string };
  comments: TaskComment[];
  currentUserId: string;
  canWrite: boolean;
  assignees: TaskAssigneeOption[];
  mentions: MentionItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const initialDoc = (task.descriptionDoc as JSONContent | null) ??
    (task.description
      ? {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: task.description }] }],
        }
      : null);
  const [descriptionDoc, setDescriptionDoc] = useState<JSONContent | null>(initialDoc);
  const [descriptionPlain, setDescriptionPlain] = useState(task.description ?? "");
  const [commentDoc, setCommentDoc] = useState<JSONContent | null>(null);
  const [commentPlain, setCommentPlain] = useState("");

  return (
    <ActionSheet
      title="Card"
      description={
        milestoneRef
          ? `Linked to ${milestoneRef.label}. Description, schedule, and comments.`
          : "Description, schedule, and comments."
      }
      hideTrigger
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await updateTaskAction(orgSlug, task.id, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Card saved");
            router.refresh();
          });
        }}
      >
        <Field label="Title" htmlFor="title">
          <Input id="title" name="title" required defaultValue={task.title} disabled={!canWrite} />
        </Field>
        <Field label="Description" htmlFor="description">
          <HiddenDocFields name="description" doc={descriptionDoc} plain={descriptionPlain} />
          <RichEditor
            value={descriptionDoc}
            editable={canWrite}
            orgSlug={orgSlug}
            entityType="task"
            entityId={task.id}
            mentions={mentions}
            placeholder="What this card is for… Use @ to reference."
            onChange={(doc, plain) => {
              setDescriptionDoc(doc);
              setDescriptionPlain(plain);
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Priority" htmlFor="priority">
            <NativeSelect id="priority" name="priority" defaultValue={task.priority} disabled={!canWrite}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </NativeSelect>
          </Field>
          <Field label="Due" htmlFor="due_on">
            <Input id="due_on" name="due_on" type="date" defaultValue={task.dueOn ?? ""} disabled={!canWrite} />
          </Field>
        </div>
        <Field label="Milestone" htmlFor="milestone_id">
          <NativeSelect id="milestone_id" name="milestone_id" defaultValue={task.milestoneId ?? ""} disabled={!canWrite}>
            <option value="">None</option>
            {milestones.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Assignee"
          htmlFor="assignee_user_id"
          hint={assignees.length === 0 ? "Add project members under Split → Team first" : undefined}
        >
          <NativeSelect
            id="assignee_user_id"
            name="assignee_user_id"
            defaultValue={task.assigneeUserId ?? ""}
            disabled={!canWrite || assignees.length === 0}
          >
            <option value="">Unassigned</option>
            {assignees.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {milestoneRef ? (
          <p className="rounded-2xl bg-sky-50 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-100">
            Reference: <span className="font-semibold">{milestoneRef.label}</span>
          </p>
        ) : null}
        {canWrite ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save card"}
          </Button>
        ) : null}
      </form>

      <div className="mt-6">
        <h3 className="text-sm font-medium">Comments</h3>
        <ul className="mt-3 space-y-3">
          {comments.length === 0 ? (
            <li className="text-sm text-muted-foreground">No comments yet.</li>
          ) : (
            comments.map((comment) => (
              <li key={comment.id} className="rounded-2xl bg-muted/60 px-3 py-2">
                {comment.bodyDoc ? (
                  <RichEditor
                    value={comment.bodyDoc as JSONContent}
                    editable={false}
                    minHeightClassName="min-h-0"
                  />
                ) : (
                  <p className="text-sm">{comment.body}</p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {comment.createdBy === currentUserId ? "You" : "Teammate"} ·{" "}
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>
        {canWrite ? (
          <form
            className="mt-3 grid gap-2"
            action={(formData) => {
              start(async () => {
                const result = await addTaskCommentAction(orgSlug, task.id, formData);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                setCommentDoc(null);
                setCommentPlain("");
                router.refresh();
              });
            }}
          >
            <HiddenDocFields name="body" doc={commentDoc} plain={commentPlain} />
            <RichEditor
              key={comments.length}
              value={commentDoc}
              orgSlug={orgSlug}
              entityType="task"
              entityId={task.id}
              mentions={mentions}
              placeholder="Write a comment… Use @ to reference."
              minHeightClassName="min-h-20"
              onChange={(doc, plain) => {
                setCommentDoc(doc);
                setCommentPlain(plain);
              }}
            />
            <Button type="submit" variant="outline" disabled={pending || !commentPlain.trim()}>
              Comment
            </Button>
          </form>
        ) : null}
      </div>

      {canWrite ? (
        <Button
          className="mt-6"
          variant="ghost"
          onClick={() => {
            if (!window.confirm("Remove this card?")) return;
            start(async () => {
              const result = await deleteTaskAction(orgSlug, task.id);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              onClose();
              router.refresh();
            });
          }}
        >
          Remove card
        </Button>
      ) : null}
    </ActionSheet>
  );
}
