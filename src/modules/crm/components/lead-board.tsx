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
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadRecord,
  type LeadStage,
} from "@/modules/crm/types";
import { formatMoney } from "@/shared/money";

const STAGE_TONE: Record<
  LeadStage,
  "planning" | "hourly" | "due" | "partial" | "paid" | "overdue" | "cancelled"
> = {
  new: "planning",
  contacted: "hourly",
  discovery: "due",
  qualified: "partial",
  proposal: "due",
  negotiation: "partial",
  won: "paid",
  lost: "cancelled",
};

function groupLeads(leads: LeadRecord[]) {
  const map = new Map<LeadStage, LeadRecord[]>();
  for (const stage of LEAD_STAGES) map.set(stage, []);
  const sorted = [...leads].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  for (const lead of sorted) {
    map.get(lead.stage)?.push(lead);
  }
  return map;
}

export function LeadBoard({
  orgSlug,
  leads,
  canWrite,
  activeLeadId,
}: {
  orgSlug: string;
  leads: LeadRecord[];
  canWrite: boolean;
  activeLeadId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(() => groupLeads(leads));
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setItems(groupLeads(leads));
  }, [leads]);

  const leadMap = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const overlay = activeId ? leadMap.get(activeId) : null;

  function stageOf(leadId: string): LeadStage | null {
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
    const overStage = (LEAD_STAGES as readonly string[]).includes(overId)
      ? (overId as LeadStage)
      : stageOf(overId);
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
        setItems(groupLeads(leads));
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
        {LEAD_STAGES.map((stage) => {
          const column = items.get(stage) ?? [];
          return (
            <BoardColumn
              key={stage}
              id={stage}
              title={LEAD_STAGE_LABELS[stage]}
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
  disabled,
  active,
  onOpen,
}: {
  lead: LeadRecord;
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
          <StatusChip tone={STAGE_TONE[lead.stage]}>
            {LEAD_STAGE_LABELS[lead.stage]}
          </StatusChip>
          {lead.estimatedValueMinor != null ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatMoney({
                amountMinor: lead.estimatedValueMinor,
                currency: lead.currency,
              })}
            </span>
          ) : null}
          {lead.stage === "won" && !lead.clientId ? (
            <span className="text-[11px] font-medium text-emerald-700">Become a client →</span>
          ) : null}
        </div>
      </BoardCardShell>
    </div>
  );
}
