"use client";

import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Flag,
  FolderKanban,
  Milestone as MilestoneIcon,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { AvatarMark } from "@/components/studio/avatar-mark";
import { TagRow, projectToneClass } from "@/components/studio/project-chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  KIND_MARK,
  PRIORITY_MARK,
} from "@/modules/delivery/components/task-board-card";
import {
  TASK_KINDS,
  TASK_PRIORITIES,
  type TaskAssigneeOption,
  type TaskKind,
  type TaskPriority,
} from "@/modules/delivery/types";

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
        <span className="inline-flex size-4 items-center justify-center text-muted-foreground/80">
          {icon}
        </span>
        {label}
      </div>
      {children}
    </div>
  );
}

function propertyTriggerClass(disabled?: boolean) {
  return cn(
    "flex w-full items-center gap-2 rounded-xl bg-card px-2.5 py-2 text-left text-sm font-medium ring-1 ring-foreground/8 transition-colors",
    disabled
      ? "cursor-not-allowed opacity-60"
      : "hover:bg-muted/70 hover:ring-foreground/12",
  );
}

export function TaskDetailFields({
  formId,
  canWrite,
  showProjectPicker,
  projects,
  projectId,
  onProjectChange,
  projectLocked = false,
  assignees,
  assigneeUserIds,
  onAssigneesChange,
  kind,
  onKindChange,
  priority,
  onPriorityChange,
  dueOn,
  onDueChange,
  milestones,
  milestoneId,
  onMilestoneChange,
  labels,
  onLabelsChange,
}: {
  formId: string;
  canWrite: boolean;
  showProjectPicker?: boolean;
  projects?: { id: string; name: string }[];
  projectId: string;
  onProjectChange: (id: string) => void;
  projectLocked?: boolean;
  assignees: TaskAssigneeOption[];
  assigneeUserIds: string[];
  onAssigneesChange: (ids: string[]) => void;
  kind: TaskKind;
  onKindChange: (kind: TaskKind) => void;
  priority: TaskPriority;
  onPriorityChange: (priority: TaskPriority) => void;
  dueOn: string;
  onDueChange: (value: string) => void;
  milestones: { id: string; name: string }[];
  milestoneId: string;
  onMilestoneChange: (id: string) => void;
  labels: string[];
  onLabelsChange: (labels: string[]) => void;
}) {
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  const selectedAssignees = assignees.filter((row) =>
    assigneeUserIds.includes(row.userId),
  );
  const selectedMilestone = milestones.find((row) => row.id === milestoneId) ?? null;
  const selectedProject = projects?.find((row) => row.id === projectId) ?? null;

  function toggleAssignee(userId: string) {
    if (assigneeUserIds.includes(userId)) {
      onAssigneesChange(assigneeUserIds.filter((id) => id !== userId));
      return;
    }
    if (assigneeUserIds.length >= 8) return;
    onAssigneesChange([...assigneeUserIds, userId]);
  }

  function commitLabel(raw: string) {
    const next = raw.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!next) return;
    if (labels.some((label) => label.toLowerCase() === next.toLowerCase())) {
      setLabelDraft("");
      return;
    }
    if (labels.length >= 12) return;
    onLabelsChange([...labels, next]);
    setLabelDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="hidden"
        name="assignee_user_ids"
        form={formId}
        value={JSON.stringify(assigneeUserIds)}
      />
      <input type="hidden" name="kind" form={formId} value={kind} />
      <input type="hidden" name="priority" form={formId} value={priority} />
      <input type="hidden" name="due_on" form={formId} value={dueOn} />
      <input type="hidden" name="milestone_id" form={formId} value={milestoneId} />
      <input type="hidden" name="labels" form={formId} value={JSON.stringify(labels)} />

      {showProjectPicker ? (
        <PropertyRow icon={<FolderKanban className="size-3.5" />} label="Project">
          <Popover open={projectOpen} onOpenChange={setProjectOpen}>
            <PopoverTrigger
              disabled={!canWrite || projectLocked}
              render={
                <button
                  type="button"
                  className={propertyTriggerClass(!canWrite || projectLocked)}
                  disabled={!canWrite || projectLocked}
                />
              }
            >
              <span className="min-w-0 flex-1 truncate">
                {selectedProject?.name ?? "Pick a project"}
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1.5">
              <ul className="max-h-56 overflow-y-auto">
                {(projects ?? []).map((project) => {
                  const active = project.id === projectId;
                  return (
                    <li key={project.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm font-medium",
                          active ? "bg-primary/12 text-primary" : "hover:bg-muted",
                        )}
                        onClick={() => {
                          onProjectChange(project.id);
                          setProjectOpen(false);
                        }}
                      >
                        {project.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        </PropertyRow>
      ) : null}

      <PropertyRow icon={<CheckSquare className="size-3.5" />} label="Type">
        <div
          role="radiogroup"
          aria-label="Card type"
          className="grid grid-cols-2 gap-1.5"
        >
          {TASK_KINDS.map((value) => {
            const mark = KIND_MARK[value];
            const Icon = mark.Icon;
            const active = kind === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!canWrite}
                onClick={() => onKindChange(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold ring-1 transition-colors",
                  active
                    ? mark.tone
                    : "bg-card text-muted-foreground ring-foreground/8 hover:bg-muted/70 hover:text-foreground",
                  !canWrite && "cursor-not-allowed opacity-60",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {mark.label}
              </button>
            );
          })}
        </div>
      </PropertyRow>

      <PropertyRow icon={<Flag className="size-3.5" />} label="Priority">
        <div
          role="radiogroup"
          aria-label="Priority"
          className="inline-flex w-full items-center gap-0.5 rounded-xl bg-muted/80 p-1 ring-1 ring-foreground/6"
        >
          {TASK_PRIORITIES.map((value) => {
            const mark = PRIORITY_MARK[value];
            const Icon = mark.Icon;
            const active = priority === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!canWrite}
                title={mark.label}
                onClick={() => onPriorityChange(value)}
                className={cn(
                  "inline-flex h-8 flex-1 items-center justify-center gap-0.5 rounded-lg text-[11px] font-bold tracking-wide transition-colors",
                  active
                    ? mark.badge
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                  !canWrite && "cursor-not-allowed opacity-60",
                )}
              >
                <Icon className="size-3 stroke-[2.5]" aria-hidden />
                {mark.letter}
              </button>
            );
          })}
        </div>
      </PropertyRow>

      <PropertyRow icon={<UserRound className="size-3.5" />} label="Assignees">
        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger
            disabled={!canWrite || assignees.length === 0}
            render={
              <button
                type="button"
                className={propertyTriggerClass(!canWrite || assignees.length === 0)}
                disabled={!canWrite || assignees.length === 0}
              />
            }
          >
            {selectedAssignees.length > 0 ? (
              <span className="flex -space-x-1.5">
                {selectedAssignees.slice(0, 3).map((member) => (
                  <AvatarMark
                    key={member.userId}
                    name={member.label}
                    src={member.avatarUrl}
                    size="sm"
                    className="ring-2 ring-card"
                  />
                ))}
              </span>
            ) : (
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/8">
                <UserRound className="size-3.5" />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">
              {selectedAssignees.length === 0
                ? assignees.length === 0
                  ? "No members yet"
                  : "Unassigned"
                : selectedAssignees.length === 1
                  ? selectedAssignees[0].label
                  : `${selectedAssignees.length} people`}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-1.5">
            <ul className="max-h-56 overflow-y-auto">
              <li>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm",
                    assigneeUserIds.length === 0
                      ? "bg-primary/12 font-semibold text-primary"
                      : "hover:bg-muted",
                  )}
                  onClick={() => onAssigneesChange([])}
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/8">
                    <UserRound className="size-3.5" />
                  </span>
                  Clear all
                </button>
              </li>
              {assignees.map((member) => {
                const active = assigneeUserIds.includes(member.userId);
                return (
                  <li key={member.userId}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm",
                        active
                          ? "bg-primary/12 font-semibold text-primary"
                          : "hover:bg-muted",
                      )}
                      onClick={() => toggleAssignee(member.userId)}
                    >
                      <AvatarMark name={member.label} src={member.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{member.label}</span>
                      {active ? (
                        <span className="text-[11px] font-bold tracking-wide text-primary uppercase">
                          On
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="px-2 pt-1.5 text-[11px] text-muted-foreground">
              Tap to add or remove · up to 8
            </p>
          </PopoverContent>
        </Popover>
        {assignees.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Add project members under Split → Team first
          </p>
        ) : null}
      </PropertyRow>

      <PropertyRow icon={<MilestoneIcon className="size-3.5" />} label="Milestone">
        <Popover open={milestoneOpen} onOpenChange={setMilestoneOpen}>
          <PopoverTrigger
            disabled={!canWrite}
            render={
              <button
                type="button"
                className={propertyTriggerClass(!canWrite)}
                disabled={!canWrite}
              />
            }
          >
            <span className="min-w-0 flex-1 truncate">
              {selectedMilestone?.name ?? "None"}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1.5">
            <ul className="max-h-56 overflow-y-auto">
              <li>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm",
                    !milestoneId
                      ? "bg-primary/12 font-semibold text-primary"
                      : "hover:bg-muted",
                  )}
                  onClick={() => {
                    onMilestoneChange("");
                    setMilestoneOpen(false);
                  }}
                >
                  None
                </button>
              </li>
              {milestones.map((item) => {
                const active = item.id === milestoneId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm",
                        active
                          ? "bg-primary/12 font-semibold text-primary"
                          : "hover:bg-muted",
                      )}
                      onClick={() => {
                        onMilestoneChange(item.id);
                        setMilestoneOpen(false);
                      }}
                    >
                      <span className="min-w-0 truncate">{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </PropertyRow>

      <PropertyRow icon={<CalendarDays className="size-3.5" />} label="Due">
        <input
          type="date"
          value={dueOn}
          disabled={!canWrite}
          onChange={(event) => onDueChange(event.target.value)}
          className={cn(
            "h-10 w-full rounded-xl bg-card px-2.5 text-sm font-medium ring-1 ring-foreground/8 outline-none",
            canWrite
              ? "hover:ring-foreground/12 focus-visible:ring-2 focus-visible:ring-ring/40"
              : "cursor-not-allowed opacity-60",
          )}
        />
      </PropertyRow>

      <PropertyRow icon={<Tag className="size-3.5" />} label="Labels">
        <div className="rounded-xl bg-card p-2 ring-1 ring-foreground/8">
          {labels.length > 0 ? (
            <TagRow className="mb-2">
              {labels.map((label) => (
                <span
                  key={label}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold tracking-tight ring-1",
                    projectToneClass(label),
                  )}
                >
                  <span className="truncate">{label}</span>
                  {canWrite ? (
                    <button
                      type="button"
                      className="rounded p-0.5 opacity-70 hover:bg-foreground/10 hover:opacity-100"
                      aria-label={`Remove ${label}`}
                      onClick={() =>
                        onLabelsChange(labels.filter((row) => row !== label))
                      }
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </span>
              ))}
            </TagRow>
          ) : null}
          {canWrite ? (
            <input
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitLabel(labelDraft.replace(/,$/, ""));
                } else if (
                  event.key === "Backspace" &&
                  !labelDraft &&
                  labels.length > 0
                ) {
                  onLabelsChange(labels.slice(0, -1));
                }
              }}
              onBlur={() => {
                if (labelDraft.trim()) commitLabel(labelDraft);
              }}
              placeholder={labels.length === 0 ? "Add a label…" : "Add another…"}
              disabled={labels.length >= 12}
              className="h-8 w-full bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
            />
          ) : labels.length === 0 ? (
            <p className="px-1 py-1 text-sm text-muted-foreground">No labels</p>
          ) : null}
        </div>
      </PropertyRow>
    </div>
  );
}
