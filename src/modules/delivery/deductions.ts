export type DeductionOption = {
  id: string;
  name: string;
  bps: number;
};

/** Presets every studio starts with. Custom ones live on the organization. */
export const BUILTIN_DEDUCTIONS: DeductionOption[] = [
  { id: "none", name: "None (0%)", bps: 0 },
  { id: "pct-4", name: "4%", bps: 400 },
  { id: "upwork", name: "5% Upwork", bps: 500 },
  { id: "pct-13", name: "13%", bps: 1300 },
];

export function formatDeductionPct(bps: number) {
  const pct = bps / 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function deductionLabel(option: DeductionOption, builtin = false) {
  if (builtin || option.bps === 0) return option.name;
  return `${option.name} (${formatDeductionPct(option.bps)}%)`;
}

/** Named deductions saved on the studio, ignoring anything that isn't a real option. */
export function parseCustomDeductions(settings: unknown): DeductionOption[] {
  const raw =
    settings && typeof settings === "object"
      ? (settings as { deductions?: unknown }).deductions
      : null;
  if (!Array.isArray(raw)) return [];
  const options: DeductionOption[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const id = String((row as { id?: unknown }).id ?? "").trim();
    const name = String((row as { name?: unknown }).name ?? "").trim();
    const bps = Number((row as { bps?: unknown }).bps);
    if (!id || !name || !Number.isInteger(bps) || bps < 0 || bps > 10_000) continue;
    options.push({ id, name: name.slice(0, 40), bps });
  }
  return options;
}

/** Basis points from a project or charge form. Blank is 0. */
export function parseDeductionBps(raw: FormDataEntryValue | null): number | { error: string } {
  const text = String(raw ?? "").trim();
  if (!text) return 0;
  const bps = Number(text);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    return { error: "Tax / deduction must be between 0% and 100%" };
  }
  return bps;
}
