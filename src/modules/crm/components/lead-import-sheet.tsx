"use client";

import { useState, useTransition } from "react";
import { FileUp, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { importLeadsAction, type ImportLeadRow } from "@/modules/crm/settings-actions";
import type { CrmMember } from "@/modules/crm/types";

type ImportField = keyof ImportLeadRow;

const FIELDS: { key: ImportField; label: string; match: RegExp }[] = [
  { key: "name", label: "Lead / deal name", match: /^(lead|deal|opportunity|title|name|lead name|deal name)$/ },
  { key: "company", label: "Company", match: /(company|organi[sz]ation|business|account)/ },
  { key: "contactName", label: "Contact name", match: /(contact|person|full name|first name|client name)/ },
  { key: "email", label: "Email", match: /e-?mail/ },
  { key: "phone", label: "Phone", match: /(phone|mobile|whatsapp|tel)/ },
  { key: "source", label: "Source", match: /(source|channel|origin)/ },
  { key: "value", label: "Value", match: /(value|amount|budget|deal size|revenue)/ },
  { key: "stage", label: "Stage", match: /(stage|status|pipeline)/ },
  { key: "tags", label: "Tags", match: /(tag|label)/ },
  { key: "notes", label: "Notes", match: /(note|comment|description|message)/ },
];

const MAX_ROWS = 1000;

/** RFC 4180-ish: quoted fields, escaped quotes, CRLF/LF, comma or semicolon. */
function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function guessMapping(headers: string[]): Record<ImportField, number> {
  const mapping = {} as Record<ImportField, number>;
  const used = new Set<number>();
  for (const field of FIELDS) {
    const index = headers.findIndex(
      (header, at) => !used.has(at) && field.match.test(header.trim().toLowerCase()),
    );
    mapping[field.key] = index;
    if (index >= 0) used.add(index);
  }
  return mapping;
}

type Parsed = { fileName: string; headers: string[]; rows: string[][] };

export function LeadImportSheet({
  orgSlug,
  members,
  currentUserId,
}: {
  orgSlug: string;
  members: CrmMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<ImportField, number> | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [owner, setOwner] = useState(currentUserId);

  function reset() {
    setParsed(null);
    setMapping(null);
  }

  async function readFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Keep CSV files under 5 MB");
      return;
    }
    const table = parseCsv(await file.text());
    if (table.length < 2) {
      toast.error("That file has no rows under the header");
      return;
    }
    const [headers, ...rows] = table;
    if (rows.length > MAX_ROWS) {
      toast.error(`Import up to ${MAX_ROWS.toLocaleString()} rows at a time`);
      return;
    }
    setParsed({ fileName: file.name, headers, rows });
    setMapping(guessMapping(headers));
  }

  const records: ImportLeadRow[] =
    parsed && mapping
      ? parsed.rows.map((cells) => {
          const record: ImportLeadRow = {};
          for (const field of FIELDS) {
            const at = mapping[field.key];
            if (at >= 0) record[field.key] = cells[at]?.trim() ?? "";
          }
          return record;
        })
      : [];
  const named = records.filter((row) => row.name || row.company || row.contactName).length;
  const hasIdentity =
    mapping != null && (mapping.name >= 0 || mapping.company >= 0 || mapping.contactName >= 0);

  function runImport() {
    start(async () => {
      const result = await importLeadsAction(orgSlug, records, {
        skipDuplicates,
        ownerUserId: owner === "none" ? null : owner,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        if (result.imported) router.refresh();
        return;
      }
      const skipped = result.skipped ?? 0;
      toast.success(
        `Imported ${result.imported} lead${result.imported === 1 ? "" : "s"}` +
          (skipped ? ` · skipped ${skipped}` : ""),
      );
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <ActionSheet
      title="Import leads"
      description="Upload a CSV from a spreadsheet or another CRM. Columns are matched automatically. Check them before importing."
      triggerLabel="Import"
      triggerVariant="outline"
      triggerSize="sm"
      triggerIcon={<FileUp className="size-3.5" />}
      triggerIconOnly
      triggerAriaLabel="Import leads from CSV"
      width="wide"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      footer={
        parsed ? (
          <div className="flex w-full items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
              Choose another file
            </Button>
            <Button type="button" onClick={runImport} disabled={pending || !hasIdentity || named === 0}>
              <Upload className="size-4" />
              {pending ? "Importing…" : `Import ${named} lead${named === 1 ? "" : "s"}`}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!parsed || !mapping ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-14 text-center hover:bg-muted/40">
          <FileUp className="size-6 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold">Choose a CSV file</span>
          <span className="text-xs text-muted-foreground">
            First row should be column headers. Up to {MAX_ROWS.toLocaleString()} rows.
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </label>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm">
            <span className="font-semibold">{parsed.fileName}</span>
            <span className="text-muted-foreground">
              {" "}
              · {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}
            </span>
          </p>

          <section className="grid gap-2 rounded-2xl bg-muted/30 p-4">
            <h3 className="text-sm font-semibold">Match columns</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm">
                  <span className="w-32 shrink-0 text-muted-foreground">{field.label}</span>
                  <NativeSelect
                    value={String(mapping[field.key])}
                    onChange={(event) =>
                      setMapping({ ...mapping, [field.key]: Number(event.target.value) })
                    }
                    className="h-8 min-w-0 flex-1"
                  >
                    <option value="-1">Skip</option>
                    {parsed.headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={index}>
                        {header || `Column ${index + 1}`}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              ))}
            </div>
            {!hasIdentity ? (
              <p className="text-xs text-destructive">
                Map at least a name, company, or contact column.
              </p>
            ) : null}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Owner" htmlFor="crm_import_owner">
              <NativeSelect
                id="crm_import_owner"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
              >
                <option value="none">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(event) => setSkipDuplicates(event.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Skip emails already in the CRM
            </label>
          </div>

          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Preview</h3>
            <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">Contact</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 6).map((row, index) => (
                    <tr key={index} className="border-t border-border/50">
                      <td className="max-w-40 truncate px-3 py-2 font-medium">
                        {row.name || row.company || row.contactName || (
                          <span className="text-destructive">Missing, skipped</span>
                        )}
                      </td>
                      <td className="max-w-32 truncate px-3 py-2">{row.contactName || "-"}</td>
                      <td className="max-w-40 truncate px-3 py-2">{row.email || "-"}</td>
                      <td className="max-w-28 truncate px-3 py-2">{row.source || "Import"}</td>
                      <td className="max-w-28 truncate px-3 py-2">{row.stage || "First stage"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {records.length > 6 ? (
              <p className="text-xs text-muted-foreground">+ {records.length - 6} more</p>
            ) : null}
          </section>
        </div>
      )}
    </ActionSheet>
  );
}
