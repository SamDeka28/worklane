"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { addProjectDeductionAction } from "@/modules/delivery/actions";
import {
  BUILTIN_DEDUCTIONS,
  deductionLabel,
  formatDeductionPct,
  type DeductionOption,
} from "@/modules/delivery/deductions";

const CUSTOM = "custom";

/** Tax / deduction: the built-in presets, any the studio has added, or a typed percent. */
export function DeductionField({
  orgSlug,
  inputName,
  defaultBps,
  deductions,
  id = inputName,
  hint,
  onBpsChange,
}: {
  orgSlug: string;
  inputName: string;
  defaultBps: number;
  deductions: DeductionOption[];
  id?: string;
  hint?: string;
  onBpsChange?: (bps: number) => void;
}) {
  const [extra, setExtra] = useState(deductions);
  const options = [...BUILTIN_DEDUCTIONS, ...extra];
  const initial = options.find((option) => option.bps === defaultBps);
  const [choice, setChoice] = useState(initial ? initial.id : CUSTOM);
  const [pct, setPct] = useState(initial ? "" : formatDeductionPct(defaultBps));
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPct, setNewPct] = useState("");
  const [pending, start] = useTransition();

  const selected = options.find((option) => option.id === choice);
  const customBps = Math.round(Number(pct || "0") * 100);
  const bps = choice === CUSTOM ? (Number.isFinite(customBps) ? customBps : 0) : (selected?.bps ?? 0);

  function choose(next: string) {
    setChoice(next);
    const option = options.find((row) => row.id === next);
    onBpsChange?.(next === CUSTOM ? (Number.isFinite(customBps) ? customBps : 0) : (option?.bps ?? 0));
  }

  return (
    <Field
      label="Tax / deduction"
      htmlFor={id}
      hint={
        hint ??
        "Taken off the client total before anything is split. Pick a preset, type a percent, or save a new one."
      }
    >
      <input type="hidden" name={inputName} value={String(bps)} />
      <NativeSelect id={id} value={choice} onChange={(event) => choose(event.target.value)}>
        {BUILTIN_DEDUCTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
        {extra.map((option) => (
          <option key={option.id} value={option.id}>
            {deductionLabel(option)}
          </option>
        ))}
        <option value={CUSTOM}>Custom percent</option>
      </NativeSelect>
      {choice === CUSTOM ? (
        <Input
          className="mt-2"
          type="number"
          min="0"
          max="100"
          step="0.01"
          inputMode="decimal"
          placeholder="e.g. 10"
          aria-label="Deduction percent"
          value={pct}
          onChange={(event) => {
            setPct(event.target.value);
            const next = Math.round(Number(event.target.value || "0") * 100);
            onBpsChange?.(Number.isFinite(next) ? next : 0);
          }}
        />
      ) : null}
      {adding ? (
        <div className="mt-2 grid grid-cols-[1fr_5.5rem_auto] gap-2">
          <Input
            value={newName}
            placeholder="Name, e.g. TDS"
            aria-label="New deduction name"
            onChange={(event) => setNewName(event.target.value)}
          />
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            inputMode="decimal"
            placeholder="%"
            aria-label="New deduction percent"
            value={newPct}
            onChange={(event) => setNewPct(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              start(async () => {
                const result = await addProjectDeductionAction(orgSlug, newName, newPct);
                if ("error" in result && result.error) {
                  toast.error(result.error);
                  return;
                }
                if ("deduction" in result && result.deduction) {
                  setExtra((current) => [...current, result.deduction]);
                  setChoice(result.deduction.id);
                  onBpsChange?.(result.deduction.bps);
                  setAdding(false);
                  setNewName("");
                  setNewPct("");
                  toast.success("Deduction added");
                }
              });
            }}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setAdding(true)}
        >
          Add a deduction
        </button>
      )}
    </Field>
  );
}
