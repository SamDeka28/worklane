export type OwnerFilter = {
  ids: string[];
  unassigned: boolean;
};

/** `me` means the signed-in person. A single id and `none` still match older links. */
export function parseOwnerFilter(raw: string, currentUserId: string): OwnerFilter {
  const ids: string[] = [];
  let unassigned = false;
  for (const part of raw.split(",").map((value) => value.trim()).filter(Boolean)) {
    if (part === "none") unassigned = true;
    else if (part === "me") {
      if (!ids.includes(currentUserId)) ids.push(currentUserId);
    } else if (!ids.includes(part)) ids.push(part);
  }
  return { ids, unassigned };
}

export function serializeOwnerFilter(ids: string[], unassigned: boolean) {
  return [...ids, ...(unassigned ? ["none"] : [])].join(",");
}

export function leadMatchesOwner(ownerUserId: string | null, filter: OwnerFilter) {
  if (filter.ids.length === 0 && !filter.unassigned) return true;
  if (ownerUserId && filter.ids.includes(ownerUserId)) return true;
  if (!ownerUserId && filter.unassigned) return true;
  return false;
}
