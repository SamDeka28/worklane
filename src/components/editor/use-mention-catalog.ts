"use client";

import { useEffect, useMemo, useState } from "react";
import type { MentionItem } from "@/components/editor/mention-suggestion";
import { listMentionCatalogAction } from "@/modules/mentions/actions";

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<MentionItem[]> }>();

function loadCatalog(orgSlug: string) {
  const hit = cache.get(orgSlug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = listMentionCatalogAction(orgSlug).catch(() => {
    cache.delete(orgSlug);
    return [] as MentionItem[];
  });
  cache.set(orgSlug, { at: Date.now(), promise });
  return promise;
}

/** Page-supplied mentions first (they may carry create actions), then the studio-wide catalog. */
export function useMentionCatalog(
  orgSlug: string | undefined,
  local: MentionItem[],
  enabled = true,
): MentionItem[] {
  const [catalog, setCatalog] = useState<MentionItem[]>([]);

  useEffect(() => {
    if (!orgSlug || !enabled) return;
    let cancelled = false;
    void loadCatalog(orgSlug).then((items) => {
      if (!cancelled) setCatalog(items);
    });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, enabled]);

  return useMemo(() => {
    const seen = new Set<string>();
    const out: MentionItem[] = [];
    for (const item of [...local, ...catalog]) {
      const key = item.create ? item.id : `${item.type}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, [local, catalog]);
}
