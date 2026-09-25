import type { DocSearchEntry } from "./types";

function scoreEntry(entry: DocSearchEntry, terms: string[]): number {
  const title = entry.title.toLowerCase();
  const summary = entry.summary.toLowerCase();
  const headings = entry.headings.join(" ").toLowerCase();
  const category = entry.category.toLowerCase();
  let total = 0;
  for (const term of terms) {
    if (title.includes(term)) total += title.startsWith(term) ? 12 : 8;
    else if (headings.includes(term)) total += 4;
    else if (summary.includes(term)) total += 3;
    else if (category.includes(term)) total += 1;
    else return 0;
  }
  return total;
}

/** Every term must match somewhere; titles outrank headings, then summaries. */
export function searchDocs(
  entries: DocSearchEntry[],
  query: string,
  limit = 8,
): DocSearchEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}
