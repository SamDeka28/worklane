"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionProgress as useTransition } from "@/components/studio/use-action-progress";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBoardColumnsAction } from "@/modules/delivery/board-column-actions";
import type { BoardSystemKey, StudioBoardColumn } from "@/modules/delivery/board-columns";

const STATUS_LABEL: Record<BoardSystemKey, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
};

export function BoardColumnsForm({
  orgSlug,
  shared,
  columns,
}: {
  orgSlug: string;
  shared: boolean;
  columns: StudioBoardColumn[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(columns);
  const [useShared, setUseShared] = useState(shared);

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= rows.length) return;
    const copy = [...rows];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    setRows(copy.map((item, position) => ({ ...item, position })));
  }

  function addList() {
    if (rows.length >= 12) return;
    setRows([
      ...rows,
      { id: crypto.randomUUID(), name: "Review", position: rows.length, systemKey: null },
    ]);
  }

  return (
    <form
      className="grid max-w-lg gap-5"
      action={(formData) => {
        if (useShared) {
          const ok = window.confirm(
            "Apply these lists to every project board and the studio board? Lists that aren't in this set are removed, and their cards move to To do.",
          );
          if (!ok) return;
        }
        formData.set(
          "columns",
          JSON.stringify(rows.map((row, position) => ({ ...row, position }))),
        );
        if (useShared) formData.set("shared", "on");
        start(async () => {
          const result = await saveBoardColumnsAction(orgSlug, formData);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(useShared ? "Board columns applied" : "Board columns saved");
          router.refresh();
        });
      }}
    >
      <label className="flex items-start gap-3 rounded-2xl bg-muted/40 px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={useShared}
          onChange={(event) => setUseShared(event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span>
          <span className="font-medium">Use these columns on every board</span>
          <span className="mt-0.5 block text-muted-foreground">
            Project boards and the studio board share this set. To do, Doing, and Done stay, so card status still works. Extra lists are the same on every project.
          </span>
        </span>
      </label>

      <ol className="grid gap-2">
        {rows.map((row, index) => (
          <li key={row.id} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
              {row.systemKey ? STATUS_LABEL[row.systemKey] : "List"}
            </span>
            <Input
              value={row.name}
              aria-label={row.systemKey ? `${STATUS_LABEL[row.systemKey]} name` : "List name"}
              onChange={(event) => {
                const name = event.target.value;
                setRows((current) => current.map((item) => (item.id === row.id ? { ...item, name } : item)));
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ChevronUp className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Move down"
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              <ChevronDown className="size-4" />
            </Button>
            {row.systemKey ? (
              <span className="size-8 shrink-0" />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${row.name || "list"}`}
                onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={rows.length >= 12} onClick={addList}>
          <Plus />
          Add a list
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : useShared ? "Save and apply" : "Save"}
        </Button>
      </div>
    </form>
  );
}
