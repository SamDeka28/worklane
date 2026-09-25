"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_EXTRA_FIELDS, type InvoiceExtraField } from "@/modules/invoices/types";

/** Label/value rows posted as `${prefix}_label` / `${prefix}_value` pairs. */
export function ExtraFieldsEditor({
  prefix,
  initial,
  suggestions = [],
  addLabel = "Add field",
}: {
  prefix: string;
  initial: InvoiceExtraField[];
  suggestions?: string[];
  addLabel?: string;
}) {
  const [rows, setRows] = useState<(InvoiceExtraField & { key: number })[]>(() =>
    initial.map((row, index) => ({ ...row, key: index })),
  );
  const [nextKey, setNextKey] = useState(initial.length);
  const unused = suggestions.filter(
    (label) => !rows.some((row) => row.label.trim().toLowerCase() === label.toLowerCase()),
  );

  function add(label = "") {
    if (rows.length >= MAX_EXTRA_FIELDS) return;
    setRows((current) => [...current, { label, value: "", key: nextKey }]);
    setNextKey((key) => key + 1);
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-1.5">
          <Input
            name={`${prefix}_label`}
            value={row.label}
            onChange={(event) =>
              setRows((current) =>
                current.map((item) =>
                  item.key === row.key ? { ...item, label: event.target.value } : item,
                ),
              )
            }
            placeholder="Label"
            aria-label="Field label"
            autoComplete="off"
            data-1p-ignore
          />
          <Input
            name={`${prefix}_value`}
            value={row.value}
            onChange={(event) =>
              setRows((current) =>
                current.map((item) =>
                  item.key === row.key ? { ...item, value: event.target.value } : item,
                ),
              )
            }
            placeholder="Value"
            aria-label={`${row.label || "Field"} value`}
            autoComplete="off"
            data-1p-ignore
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="self-center text-muted-foreground"
            aria-label="Remove field"
            onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      {rows.length < MAX_EXTRA_FIELDS ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {unused.slice(0, 4).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => add(label)}
              className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              + {label}
            </button>
          ))}
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => add()}>
            <Plus className="size-3.5" />
            {addLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
