export type TaskFieldPlan<T> = { omit: true } | { value: T } | { error: string };

function partsOf(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.map((item) => String(item ?? ""));
  const text = raw.trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item ?? ""));
    } catch {
      return text.split(/[,|\n]/);
    }
  }
  return text.split(/[,|\n]/);
}

export function planTaskChoice<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
  label: string,
): TaskFieldPlan<T> {
  if (raw == null || raw.trim() === "") return { omit: true };
  const value = raw.trim().toLowerCase();
  if (!(allowed as readonly string[]).includes(value)) {
    return { error: `${label} must be ${allowed.join(", ")}` };
  }
  return { value: value as T };
}

/** Up to 12 labels, 24 characters each. An empty value clears the list. */
export function planTaskLabels(raw: string | string[] | null | undefined): TaskFieldPlan<string[]> {
  if (raw === undefined) return { omit: true };
  if (raw === null) return { value: [] };
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of partsOf(raw)) {
    const label = part.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
    if (labels.length > 12) return { error: "A card can have at most 12 labels" };
  }
  return { value: labels };
}

/** Up to 8 user ids. An empty value clears assignees. */
export function planAssigneeIds(raw: string | string[] | null | undefined): TaskFieldPlan<string[]> {
  if (raw === undefined) return { omit: true };
  if (raw === null) return { value: [] };
  const ids = [...new Set(partsOf(raw).map((item) => item.trim()).filter(Boolean))];
  if (ids.length > 8) return { error: "A card can have at most 8 assignees" };
  return { value: ids };
}

export function cardListFromToolInput(
  primary: string | string[] | null | undefined,
  alias: string | string[] | null | undefined,
): string | string[] | null | undefined {
  if (primary !== undefined) return primary ?? "";
  if (alias !== undefined) return alias ?? "";
  return undefined;
}
