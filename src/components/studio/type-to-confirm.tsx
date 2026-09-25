"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ConfirmResult = { error?: string | null } | { ok: true } | void;

export type TypeToConfirmProps = {
  title: string;
  description: ReactNode;
  /** Text the user must type exactly (usually the record's name or email). */
  confirmValue: string;
  actionLabel: string;
  pendingLabel?: string;
  onConfirm: () => Promise<ConfirmResult>;
  onDone?: () => void;
};

export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmValue,
  actionLabel,
  pendingLabel = "Deleting…",
  onConfirm,
  onDone,
}: TypeToConfirmProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const matches = typed.trim() === confirmValue.trim();

  function change(next: boolean) {
    if (pending) return;
    if (next) setTyped("");
    onOpenChange(next);
  }

  function submit() {
    if (!matches) return;
    start(async () => {
      const result = await onConfirm();
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      onDone?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="grid gap-2 text-sm">
            <span className="text-muted-foreground">
              To confirm, type{" "}
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem] font-semibold break-all text-foreground select-all">
                {confirmValue}
              </span>{" "}
              below
            </span>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              aria-label={`Type ${confirmValue} to confirm`}
            />
          </label>
          <Button type="submit" variant="destructive" disabled={!matches || pending}>
            {pending ? pendingLabel : actionLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Opens a type-to-confirm dialog from any trigger (menu item, icon button, …). */
export function useTypeToConfirm() {
  const [open, setOpen] = useState(false);
  return {
    open: () => setOpen(true),
    dialogProps: { open, onOpenChange: setOpen },
  };
}

export function DangerZone({
  heading,
  summary,
  buttonLabel,
  className,
  ...dialog
}: TypeToConfirmProps & {
  heading: string;
  summary: ReactNode;
  buttonLabel: string;
  className?: string;
}) {
  const confirm = useTypeToConfirm();
  return (
    <section className={cn("rounded-2xl p-4 ring-1 ring-destructive/30", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-destructive">{heading}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{summary}</p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="shrink-0"
          onClick={confirm.open}
        >
          {buttonLabel}
        </Button>
      </div>
      <TypeToConfirmDialog {...dialog} {...confirm.dialogProps} />
    </section>
  );
}
