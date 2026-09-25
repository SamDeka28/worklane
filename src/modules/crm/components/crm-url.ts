"use client";

/**
 * Shallow CRM URL update: syncs `useSearchParams` without a server round trip,
 * so the lead sheet opens and closes instantly.
 */
export function setCrmUrl(
  params: { lead?: string | null; new?: string | null; stage?: string | null },
  mode: "push" | "replace" = "replace",
) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  const next = `${url.pathname}${url.search}`;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

export function openLead(leadId: string) {
  setCrmUrl({ lead: leadId }, "push");
}

export function openNewLead(stage?: string) {
  setCrmUrl({ new: "1", stage: stage ?? null, lead: null });
}
