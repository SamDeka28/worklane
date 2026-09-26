"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BoardCanvas,
  BoardCardShell,
  BoardColumn,
  boardCollisionDetection,
  useBoardDndSensors,
} from "@/components/studio/board";
import { StatusChip } from "@/components/studio/status-chip";
import { cn } from "@/lib/utils";
import { setProjectStatusAction } from "@/modules/delivery/actions";
import type { ProjectRecord, ProjectStatus } from "@/modules/delivery/types";
import { moneyLabel } from "@/modules/finance/ledger";

const BOARD_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold", "completed"];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

type BoardRow = {
  project: ProjectRecord;
  outstandingMinor?: bigint;
  openTasks: number;
};

function group(rows: BoardRow[]) {
  const map = new Map<ProjectStatus, BoardRow[]>();
  for (const status of BOARD_STATUSES) map.set(status, []);
  for (const row of rows) {
    if (row.project.status === "cancelled") continue;
    map.get(row.project.status)?.push(row);
  }
  return map;
}

export function ProjectStatusBoard({
  orgSlug,
  rows,
  canWrite,
  showMoney = true,
}: {
  orgSlug: string;
  rows: BoardRow[];
  canWrite: boolean;
  showMoney?: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const serverItems = useMemo(() => group(rows), [rows]);
  const [items, setItems] = useOptimistic(
    serverItems,
    (_current, next: Map<ProjectStatus, BoardRow[]>) => next,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ProjectStatus | null>(null);
  const sensors = useBoardDndSensors();

  const projectMap = useMemo(
    () => new Map(rows.map((row) => [row.project.id, row])),
    [rows],
  );
  const overlay = activeId ? projectMap.get(activeId) : null;

  function statusOf(projectId: string): ProjectStatus | null {
    for (const [status, list] of items) {
      if (list.some((row) => row.project.id === projectId)) return status;
    }
    return null;
  }

  function onDragEnd(event: DragEndEvent) {
    const projectId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveId(null);
    setOverStatus(null);
    if (!overId || !canWrite) return;

    const from = statusOf(projectId);
    const to = (BOARD_STATUSES as readonly string[]).includes(overId)
      ? (overId as ProjectStatus)
      : statusOf(overId);
    if (!from || !to || from === to) return;

    const fromList = items.get(from) ?? [];
    const toList = items.get(to) ?? [];
    const moving = fromList.find((row) => row.project.id === projectId);
    if (!moving) return;

    const next = new Map(items);
    next.set(
      from,
      fromList.filter((row) => row.project.id !== projectId),
    );
    next.set(to, [
      ...toList,
      { ...moving, project: { ...moving.project, status: to } },
    ]);
    start(async () => {
      setItems(next);
      const result = await setProjectStatusAction(orgSlug, projectId, to);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragOver={({ over }) => {
        if (!over) {
          setOverStatus(null);
          return;
        }
        const overId = String(over.id);
        const next = (BOARD_STATUSES as readonly string[]).includes(overId)
          ? (overId as ProjectStatus)
          : statusOf(overId);
        setOverStatus(next);
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setOverStatus(null);
      }}
    >
      <BoardCanvas>
        {BOARD_STATUSES.map((status) => {
          const column = items.get(status) ?? [];
          return (
            <BoardColumn
              key={status}
              id={status}
              title={STATUS_LABEL[status]}
              count={column.length}
              isOver={Boolean(activeId) && overStatus === status}
            >
              <SortableContext
                items={column.map((row) => row.project.id)}
                strategy={verticalListSortingStrategy}
              >
                {column.map((row) => (
                  <SortableProjectCard
                    key={row.project.id}
                    row={row}
                    showMoney={showMoney}
                    disabled={!canWrite}
                    onOpen={() => router.push(`/${orgSlug}/projects/${row.project.id}`)}
                  />
                ))}
              </SortableContext>
              {column.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Drop projects here
                </p>
              ) : null}
            </BoardColumn>
          );
        })}
      </BoardCanvas>
      {typeof document !== "undefined"
        ? createPortal(
            <DragOverlay dropAnimation={null}>
              {overlay ? (
                <BoardCardShell className="w-72 cursor-grabbing shadow-soft">
                  <p className="truncate text-sm font-medium">{overlay.project.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {overlay.project.clientName}
                  </p>
                </BoardCardShell>
              ) : null}
            </DragOverlay>,
            document.body,
          )
        : null}
    </DndContext>
  );
}

function SortableProjectCard({
  row,
  showMoney,
  disabled,
  onOpen,
}: {
  row: BoardRow;
  showMoney: boolean;
  disabled?: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.project.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0 : undefined,
      }}
      className={cn(isDragging && "z-10")}
      {...attributes}
      {...listeners}
    >
      <BoardCardShell onClick={onOpen}>
        <p className="truncate text-sm font-medium">{row.project.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {row.project.clientName}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <StatusChip tone={row.project.status === "active" ? "active" : "planning"}>
            {STATUS_LABEL[row.project.status]}
          </StatusChip>
          {showMoney && row.outstandingMinor != null ? (
            <span className="tabular-nums">
              {moneyLabel(row.outstandingMinor, row.project.currency)} due
            </span>
          ) : null}
          {row.openTasks > 0 ? <span>{row.openTasks} open</span> : null}
        </div>
      </BoardCardShell>
    </div>
  );
}

