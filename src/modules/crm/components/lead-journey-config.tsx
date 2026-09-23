"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createLeadStageAction,
  deleteLeadStageAction,
  renameLeadStageAction,
  reorderLeadStagesAction,
} from "@/modules/crm/actions";
import type { LeadStageRecord } from "@/modules/crm/types";

export function LeadJourneyConfig({
  orgSlug,
  stages,
  canWrite,
}: {
  orgSlug: string;
  stages: LeadStageRecord[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const persistable = stages.every((stage) => !stage.id.startsWith("default-"));

  if (!canWrite) return null;

  function move(stageId: string, direction: -1 | 1) {
    const index = stages.findIndex((stage) => stage.id === stageId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= stages.length) return;
    const next = [...stages];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    start(async () => {
      const result = await reorderLeadStagesAction(
        orgSlug,
        next.map((stage) => stage.id),
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <ActionSheet
      title="Lead journey"
      description="Add, rename, reorder, or remove stages. Won and Lost stay at the end."
      triggerLabel="Journey"
      triggerVariant="outline"
      triggerSize="sm"
      triggerIcon={<Settings2 className="size-3.5" />}
      triggerAriaLabel="Configure lead journey"
    >
      <div className="grid gap-4">
        {!persistable ? (
          <p className="rounded-2xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Stages aren’t stored for this studio yet. Create a lead or refresh after
            migrations, then configure the journey.
          </p>
        ) : null}

        <ul className="grid gap-2">
          {stages.map((stage, index) => {
            const locked = stage.systemKey != null;
            const editing = editingId === stage.id;
            return (
              <li
                key={stage.id}
                className="flex items-center gap-2 rounded-2xl bg-muted/40 px-2.5 py-2"
              >
                <div className="flex shrink-0 flex-col">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={!persistable || pending || index === 0}
                    aria-label="Move up"
                    onClick={() => move(stage.id, -1)}
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={!persistable || pending || index === stages.length - 1}
                    aria-label="Move down"
                    onClick={() => move(stage.id, 1)}
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1">
                  {editing ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const name = editName.trim();
                        if (!name) return;
                        start(async () => {
                          const data = new FormData();
                          data.set("name", name);
                          const result = await renameLeadStageAction(
                            orgSlug,
                            stage.id,
                            data,
                          );
                          if (result.error) {
                            toast.error(result.error);
                            return;
                          }
                          setEditingId(null);
                          toast.success("Stage renamed");
                          router.refresh();
                        });
                      }}
                    >
                      <Input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button type="submit" size="sm" disabled={pending}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="block w-full truncate text-left text-sm font-medium hover:underline disabled:no-underline"
                      disabled={!persistable || pending}
                      onClick={() => {
                        setEditingId(stage.id);
                        setEditName(stage.name);
                      }}
                    >
                      {stage.name}
                      {locked ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {stage.systemKey}
                        </span>
                      ) : null}
                    </button>
                  )}
                </div>

                {!locked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!persistable || pending || stages.length <= 1}
                    aria-label={`Remove ${stage.name}`}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Remove “${stage.name}”? Leads in this stage move to another stage.`,
                        )
                      ) {
                        return;
                      }
                      start(async () => {
                        const result = await deleteLeadStageAction(orgSlug, stage.id);
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Stage removed");
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        <form
          className="grid gap-3 rounded-2xl bg-muted/30 p-3"
          action={(formData) => {
            start(async () => {
              const result = await createLeadStageAction(orgSlug, formData);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              setDraftName("");
              toast.success("Stage added");
              router.refresh();
            });
          }}
        >
          <Field label="New stage" htmlFor="journey_stage_name">
            <Input
              id="journey_stage_name"
              name="name"
              required
              placeholder="e.g. Demo booked"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              disabled={!persistable || pending}
            />
          </Field>
          <Button
            type="submit"
            size="sm"
            disabled={!persistable || pending || !draftName.trim()}
          >
            <Plus className="size-3.5" />
            {pending ? "Adding…" : "Add stage"}
          </Button>
        </form>
      </div>
    </ActionSheet>
  );
}
