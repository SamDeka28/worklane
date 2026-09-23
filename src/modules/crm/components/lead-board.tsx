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
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BoardCanvas, BoardCardShell, BoardColumn } from "@/components/studio/board";
import { StatusChip } from "@/components/studio/status-chip";
import { cn } from "@/lib/utils";
import { moveLeadStageAction } from "@/modules/crm/actions";
import {
  isWonStage,
  stageLabel,
  stageTone,
  type LeadRecord,
  type LeadStageRecord,
} from "@/modules/crm/types";
import { formatMoney } from "@/shared/money";

function groupLeads(leads: LeadRecord[], stages: LeadStageRecord[]) {
  const map = new Map<string, LeadRecord[]>();
  for (const stage of stages) map.set(stage.slug, []);
  const sorted = [...leads].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  for (const lead of sorted) {
    const bucket = map.get(lead.stage);
    if (bucket) bucket.push(lead);
    else {
      // Orphan stage (deleted): park under first column if any.
      const first = stages[0]?.slug;
      if (first) map.get(first)?.push(lead);
    }
  }
  return map;
}

export function LeadBoard({
  orgSlug,
  leads,
  stages,
  canWrite,
  showMoney = true,
  activeLeadId,
}: {
  orgSlug: string;
  leads: LeadRecord[];
  stages: LeadStageRecord[];
  canWrite: boolean;
  showMoney?: boolean;
  activeLeadId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(() => groupLeads(leads, stages));
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const stageSlugs = useMemo(() => new Set(stages.map((stage) => stage.slug)), [stages]);

  useEffect(() => {
    setItems(groupLeads(leads, stages));
  }, [leads, stages]);

  const leadMap = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const overlay = activeId ? leadMap.get(activeId) : null;

  function stageOf(leadId: string): string | null {
    for (const [stage, list] of items) {
      if (list.some((lead) => lead.id === leadId)) return stage;
    }
    return null;
  }

  function onDragEnd(event: DragEndEvent) {
    const leadId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveId(null);
    if (!overId || !canWrite) return;

    const fromStage = stageOf(leadId);
    const overStage = stageSlugs.has(overId) ? overId : stageOf(overId);
    if (!fromStage || !overStage) return;

    const fromList = items.get(fromStage) ?? [];
    const toList = items.get(overStage) ?? [];
    const fromIndex = fromList.findIndex((lead) => lead.id === leadId);
    if (fromIndex < 0) return;

    const next = new Map(items);
    if (fromStage === overStage) {
      const overIndex = toList.findIndex((lead) => lead.id === overId);
      const target = overIndex < 0 ? fromIndex : overIndex;
      next.set(fromStage, arrayMove(fromList, fromIndex, target));
    } else {
      const moving = fromList[fromIndex];
      const remaining = fromList.filter((lead) => lead.id !== leadId);
      const overIndex = toList.findIndex((lead) => lead.id === overId);
      const inserted = [...toList];
      inserted.splice(overIndex < 0 ? inserted.length : overIndex, 0, {
        ...moving,
        stage: overStage,
      });
      next.set(fromStage, remaining);
      next.set(overStage, inserted);
    }
    setItems(next);

    const orderedIds = (next.get(overStage) ?? []).map((lead) => lead.id);
    start(async () => {
      const result = await moveLeadStageAction(orgSlug, leadId, overStage, orderedIds);
      if (result.error) {
        toast.error(result.error);
        setItems(groupLeads(leads, stages));
        return;
      }
      router.refresh();
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <BoardCanvas>
        {stages.map((stage) => {
          const column = items.get(stage.slug) ?? [];
          return (
            <BoardColumn
              key={stage.id}
              id={stage.slug}
              title={stage.name}
              count={column.length}
            >
              <SortableContext
                items={column.map((lead) => lead.id)}
                strategy={verticalListSortingStrategy}
              >
                {column.map((lead) => (
                  <SortableLeadCard
                    key={lead.id}
                    lead={lead}
                    stages={stages}
                    showMoney={showMoney}
                    disabled={!canWrite || pending}
                    active={activeLeadId === lead.id}
                    onOpen={() =>
                      router.push(`/${orgSlug}/crm?view=board&lead=${lead.id}`)
                    }
                  />
                ))}
              </SortableContext>
              {column.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Drop leads here
                </p>
              ) : null}
            </BoardColumn>
          );
        })}
      </BoardCanvas>
      <DragOverlay>
        {overlay ? (
          <BoardCardShell className="w-72 shadow-soft">
            <p className="truncate text-sm font-medium">{overlay.name}</p>
            {overlay.company ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{overlay.company}</p>
            ) : null}
          </BoardCardShell>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableLeadCard({
  lead,
  stages,
  showMoney = true,
  disabled,
  active,
  onOpen,
}: {
  lead: LeadRecord;
  stages: LeadStageRecord[];
  showMoney?: boolean;
  disabled?: boolean;
  active?: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(active && "ring-2 ring-sky-300 rounded-2xl")}
      {...attributes}
      {...listeners}
    >
      <BoardCardShell onClick={onOpen}>
        <p className="truncate text-sm font-medium">{lead.name}</p>
        {lead.company ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.company}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusChip tone={stageTone(lead.stage, stages)}>
            {stageLabel(lead.stage, stages)}
          </StatusChip>
          {showMoney && lead.estimatedValueMinor != null ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatMoney({
                amountMinor: lead.estimatedValueMinor,
                currency: lead.currency,
              })}
            </span>
          ) : null}
          {isWonStage(lead.stage, stages) && !lead.clientId ? (
            <span className="text-[11px] font-medium text-emerald-700">Become a client →</span>
          ) : null}
        </div>
      </BoardCardShell>
    </div>
  );
}
