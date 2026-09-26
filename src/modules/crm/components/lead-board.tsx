"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  BoardCanvas,
  BoardColumn,
  boardCollisionDetection,
  useBoardDndSensors,
} from "@/components/studio/board";
import { cn } from "@/lib/utils";
import { moveLeadStageAction } from "@/modules/crm/actions";
import { openLead, openNewLead } from "@/modules/crm/components/crm-url";
import { LeadBoardCard, type LeadCardState } from "@/modules/crm/components/lead-board-card";
import { ConvertLeadDialog, LostReasonDialog } from "@/modules/crm/components/lead-outcome-dialogs";
import {
  isLostStage,
  isWonStage,
  type CrmMember,
  type LeadRecord,
  type LeadStageRecord,
} from "@/modules/crm/types";

type PendingLost = { lead: LeadRecord; stage: string; orderedIds: string[] };
const OPEN_STAGE_DOTS = [
  "bg-slate-400",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-orange-500",
];

function stageState(slug: string, stages: LeadStageRecord[]): LeadCardState {
  if (isWonStage(slug, stages)) return "won";
  if (isLostStage(slug, stages)) return "lost";
  return "open";
}

function stageDot(stage: LeadStageRecord, index: number, stages: LeadStageRecord[]) {
  const state = stageState(stage.slug, stages);
  if (state === "won") return "bg-emerald-500";
  if (state === "lost") return "bg-rose-400";
  return OPEN_STAGE_DOTS[index % OPEN_STAGE_DOTS.length];
}

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
  members = [],
  staleDays = 0,
  lostReasons = [],
}: {
  orgSlug: string;
  leads: LeadRecord[];
  stages: LeadStageRecord[];
  canWrite: boolean;
  showMoney?: boolean;
  members?: CrmMember[];
  staleDays?: number;
  lostReasons?: string[];
}) {
  const activeLeadId = useSearchParams().get("lead");
  const [, start] = useTransition();
  const [items, setItems] = useState(() => groupLeads(leads, stages));
  const [pendingLost, setPendingLost] = useState<PendingLost | null>(null);
  const [wonLead, setWonLead] = useState<LeadRecord | null>(null);
  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [activeHeight, setActiveHeight] = useState(88);
  const sensors = useBoardDndSensors();
  const stageSlugs = useMemo(() => new Set(stages.map((stage) => stage.slug)), [stages]);

  const [synced, setSynced] = useState({ leads, stages });
  if (synced.leads !== leads || synced.stages !== stages) {
    setSynced({ leads, stages });
    setItems(groupLeads(leads, stages));
  }

  const leadMap = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const overlay = activeId ? leadMap.get(activeId) : null;

  function stageOf(leadId: string): string | null {
    for (const [stage, list] of items) {
      if (list.some((lead) => lead.id === leadId)) return stage;
    }
    return null;
  }

  function resolveStage(overId: string) {
    return stageSlugs.has(overId) ? overId : stageOf(overId);
  }

  function resetDrag() {
    setActiveId(null);
    setOverStage(null);
    setDropIndex(null);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) {
      setOverStage(null);
      setDropIndex(null);
      return;
    }
    const leadId = String(active.id);
    const overId = String(over.id);
    const stage = resolveStage(overId);
    if (!stage) {
      setOverStage(null);
      setDropIndex(null);
      return;
    }
    const visible = (items.get(stage) ?? []).filter((lead) => lead.id !== leadId);
    let index = stageSlugs.has(overId)
      ? visible.length
      : Math.max(0, visible.findIndex((lead) => lead.id === overId));
    // Place after the hovered card when the pointer is in its lower half.
    if (!stageSlugs.has(overId) && active.rect.current.translated) {
      const pointerMid =
        active.rect.current.translated.top + active.rect.current.translated.height / 2;
      if (pointerMid > over.rect.top + over.rect.height / 2) index += 1;
    }
    setOverStage(stage);
    setDropIndex(Math.min(index, visible.length));
  }

  function onDragEnd(event: DragEndEvent) {
    const leadId = String(event.active.id);
    const targetStage = overStage ?? (event.over ? resolveStage(String(event.over.id)) : null);
    const targetIndex = dropIndex;
    resetDrag();
    if (!targetStage || !canWrite) return;

    const fromStage = stageOf(leadId);
    if (!fromStage) return;
    const fromList = items.get(fromStage) ?? [];
    const moving = fromList.find((lead) => lead.id === leadId);
    if (!moving) return;

    const next = new Map(items);
    next.set(
      fromStage,
      fromList.filter((lead) => lead.id !== leadId),
    );
    const base = next.get(targetStage) ?? [];
    const at = targetIndex == null ? base.length : Math.min(targetIndex, base.length);
    const inserted = [...base];
    inserted.splice(at, 0, { ...moving, stage: targetStage });
    next.set(targetStage, inserted);

    const orderedIds = inserted.map((lead) => lead.id);
    if (
      fromStage === targetStage &&
      orderedIds.every((id, index) => fromList[index]?.id === id)
    ) {
      return;
    }
    setItems(next);

    const changedStage = fromStage !== targetStage;
    if (changedStage && isLostStage(targetStage, stages)) {
      setPendingLost({ lead: moving, stage: targetStage, orderedIds });
      return;
    }

    start(async () => {
      const result = await moveLeadStageAction(orgSlug, leadId, targetStage, orderedIds);
      if (result.error) {
        toast.error(result.error);
        setItems(groupLeads(leads, stages));
        return;
      }
      if (changedStage && isWonStage(targetStage, stages) && !moving.clientId) {
        setWonLead({ ...moving, stage: targetStage });
      }
    });
  }

  async function confirmLost(outcome: { lostReason: string; lostNote: string }) {
    if (!pendingLost) return false;
    const result = await moveLeadStageAction(
      orgSlug,
      pendingLost.lead.id,
      pendingLost.stage,
      pendingLost.orderedIds,
      outcome,
    );
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    setPendingLost(null);
    return true;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={({ active }) => {
        setActiveId(String(active.id));
        const height = active.rect.current.initial?.height;
        setActiveHeight(height && height > 0 ? Math.round(height) : 88);
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={resetDrag}
    >
      <BoardCanvas className="h-full min-h-0 px-4 pb-3 pt-3 sm:px-6">
        {stages.map((stage, stageIndex) => (
          <LeadColumn
            key={stage.id}
            stage={stage}
            dot={stageDot(stage, stageIndex, stages)}
            state={stageState(stage.slug, stages)}
            leads={items.get(stage.slug) ?? []}
            showMoney={showMoney}
            canWrite={canWrite}
            disabled={!canWrite}
            memberMap={memberMap}
            staleDays={staleDays}
            selectedLeadId={activeLeadId}
            activeLeadId={activeId}
            dropActive={Boolean(activeId) && overStage === stage.slug}
            dropIndex={Boolean(activeId) && overStage === stage.slug ? dropIndex : null}
            dropHeight={activeHeight}
          />
        ))}
      </BoardCanvas>
      {typeof document !== "undefined"
        ? createPortal(
            <DragOverlay adjustScale={false} dropAnimation={null}>
              {overlay ? (
                <div className="w-74 cursor-grabbing">
                  <LeadBoardCard
                    lead={overlay}
                    state={stageState(overlay.stage, stages)}
                    showMoney={showMoney}
                    owner={overlay.ownerUserId ? memberMap.get(overlay.ownerUserId) : null}
                    staleDays={staleDays}
                    className="shadow-lift ring-primary/30"
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )
        : null}
      <LostReasonDialog
        open={Boolean(pendingLost)}
        leadName={pendingLost?.lead.name ?? ""}
        reasons={lostReasons}
        onCancel={() => {
          setPendingLost(null);
          setItems(groupLeads(leads, stages));
        }}
        onConfirm={confirmLost}
      />
      {wonLead ? (
        <ConvertLeadDialog
          orgSlug={orgSlug}
          lead={wonLead}
          open
          onOpenChange={(next) => {
            if (!next) setWonLead(null);
          }}
          onSkip={() => setWonLead(null)}
          skipLabel="Not yet"
        />
      ) : null}
    </DndContext>
  );
}

function LeadColumn({
  stage,
  dot,
  state,
  leads,
  showMoney,
  canWrite,
  disabled,
  memberMap,
  staleDays,
  selectedLeadId,
  activeLeadId,
  dropActive,
  dropIndex,
  dropHeight,
}: {
  stage: LeadStageRecord;
  dot: string;
  state: LeadCardState;
  leads: LeadRecord[];
  showMoney: boolean;
  canWrite: boolean;
  disabled: boolean;
  memberMap: Map<string, CrmMember>;
  staleDays: number;
  selectedLeadId: string | null;
  activeLeadId: string | null;
  dropActive: boolean;
  dropIndex: number | null;
  dropHeight: number;
}) {
  const visibleIds = leads.filter((lead) => lead.id !== activeLeadId).map((lead) => lead.id);
  const showingSlot = dropActive && dropIndex != null;
  const slotBeforeId = showingSlot ? (visibleIds[dropIndex] ?? null) : null;
  const slotAtEnd = showingSlot && dropIndex >= visibleIds.length;

  return (
    <BoardColumn
      id={stage.slug}
      isOver={dropActive}
      header={
        <header className="shrink-0 px-3 pt-3.5 pb-3">
          <div className="flex items-center gap-1.5">
            <span className={cn("ml-1 size-2.5 shrink-0 rounded-full", dot)} aria-hidden />
            <h2 className="min-w-0 flex-1 truncate px-1 text-[12px] font-bold tracking-[0.08em] text-foreground/70 uppercase">
              {stage.name}
            </h2>
            <span className="rounded-md bg-card px-2.5 py-1 text-xs font-bold tabular-nums text-muted-foreground shadow-sm ring-1 ring-foreground/10">
              {leads.length}
            </span>
          </div>
        </header>
      }
      footer={
        canWrite && state === "open" ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            onClick={() => openNewLead(stage.slug)}
          >
            <Plus className="size-4" />
            Add a lead
          </button>
        ) : null
      }
    >
      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        {leads.map((lead) => {
          return (
            <div key={lead.id} className="contents">
              {slotBeforeId === lead.id ? <DropSlot height={dropHeight} /> : null}
              <SortableLeadCard
                lead={lead}
                state={state}
                showMoney={showMoney}
                disabled={disabled}
                owner={lead.ownerUserId ? (memberMap.get(lead.ownerUserId) ?? null) : null}
                staleDays={staleDays}
                selected={selectedLeadId === lead.id}
                collapsed={lead.id === activeLeadId}
              />
            </div>
          );
        })}
        {slotAtEnd ? <DropSlot height={dropHeight} /> : null}
      </SortableContext>
      {leads.length === 0 && !dropActive ? (
        <p className="px-2 py-8 text-center text-sm font-medium text-muted-foreground">
          Drop leads here
        </p>
      ) : null}
    </BoardColumn>
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

function SortableLeadCard({
  lead,
  state,
  showMoney,
  disabled,
  owner,
  staleDays,
  selected,
  collapsed,
}: {
  lead: LeadRecord;
  state: LeadCardState;
  showMoney: boolean;
  disabled: boolean;
  owner: CrmMember | null;
  staleDays: number;
  selected: boolean;
  collapsed: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: "lead" as const },
    disabled,
    animateLayoutChanges: () => false,
  });
  const hidden = collapsed || isDragging;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: hidden ? undefined : CSS.Translate.toString(transform),
        transition: hidden ? undefined : transition,
      }}
      className={cn(
        "list-none",
        hidden && "pointer-events-none m-0 h-0 min-h-0 overflow-hidden border-0 p-0 opacity-0",
      )}
      {...attributes}
      {...listeners}
    >
      <LeadBoardCard
        lead={lead}
        state={state}
        showMoney={showMoney}
        selected={selected}
        onOpen={() => openLead(lead.id)}
        draggable={!disabled}
        owner={owner}
        staleDays={staleDays}
      />
    </li>
  );
}
