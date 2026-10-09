export type BoardSystemKey = "todo" | "doing" | "done";

export type StudioBoardColumn = {
  id: string;
  name: string;
  position: number;
  systemKey: BoardSystemKey | null;
};

export type BoardSettings = {
  /** One column set for every project board and the studio board. */
  shared: boolean;
  columns: StudioBoardColumn[];
};

export type ProjectColumnLink = {
  id: string;
  name: string;
  position: number;
  systemKey: BoardSystemKey | null;
  studioColumnId: string | null;
};

export type ColumnSyncPlan = {
  update: {
    id: string;
    name: string;
    position: number;
    systemKey: BoardSystemKey | null;
    studioColumnId: string;
  }[];
  insert: {
    name: string;
    position: number;
    systemKey: BoardSystemKey | null;
    studioColumnId: string;
  }[];
  /** Cards in a removed list move onto moveTasksToId before the list is deleted. */
  remove: { id: string; moveTasksToId: string | null }[];
};

const SYSTEM_KEYS: BoardSystemKey[] = ["todo", "doing", "done"];

export function defaultBoardColumns(): StudioBoardColumn[] {
  return [
    { id: "todo", name: "To do", position: 0, systemKey: "todo" },
    { id: "doing", name: "Doing", position: 1, systemKey: "doing" },
    { id: "done", name: "Done", position: 2, systemKey: "done" },
  ];
}

export function parseBoardSettings(settings: unknown): BoardSettings {
  const root =
    settings && typeof settings === "object" ? (settings as { board?: unknown }).board : null;
  const board = root && typeof root === "object" ? (root as { shared?: unknown; columns?: unknown }) : null;
  const shared = board?.shared === true;
  const parsed = Array.isArray(board?.columns) ? normalizeColumns(board.columns) : null;
  return {
    shared: shared && parsed != null,
    columns: parsed ?? defaultBoardColumns(),
  };
}

export function validateBoardColumns(columns: StudioBoardColumn[]): { error: string } | { columns: StudioBoardColumn[] } {
  const normalized = normalizeColumns(columns);
  if (!normalized) return { error: "Keep one To do, one Doing, and one Done list. Names have to be unique." };
  return { columns: normalized };
}

function normalizeColumns(raw: unknown[]): StudioBoardColumn[] | null {
  if (raw.length < 3 || raw.length > 12) return null;
  const columns: StudioBoardColumn[] = [];
  const names = new Set<string>();
  const keys = new Set<string>();
  let duplicateKey = false;
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as { id?: unknown; name?: unknown; systemKey?: unknown; position?: unknown };
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
    const systemKey = row.systemKey === "todo" || row.systemKey === "doing" || row.systemKey === "done" ? row.systemKey : null;
    if (!id || !name) return;
    columns.push({
      id,
      name,
      systemKey,
      position: typeof row.position === "number" ? row.position : index,
    });
  });
  if (columns.length !== raw.length) return null;
  columns.sort((a, b) => a.position - b.position);
  columns.forEach((column, index) => {
    column.position = index;
    const nameKey = column.name.toLowerCase();
    if (names.has(nameKey)) return;
    names.add(nameKey);
    if (column.systemKey) {
      if (keys.has(column.systemKey)) duplicateKey = true;
      keys.add(column.systemKey);
    }
  });
  if (duplicateKey || names.size !== columns.length) return null;
  if (SYSTEM_KEYS.some((key) => !keys.has(key))) return null;
  return columns;
}

/**
 * Match a project's lists onto the studio set.
 * System lists match by their status key. Anything left over is removed.
 */
export function planColumnSync(existing: ProjectColumnLink[], desired: StudioBoardColumn[]): ColumnSyncPlan {
  const used = new Set<string>();
  const update: ColumnSyncPlan["update"] = [];
  const insert: ColumnSyncPlan["insert"] = [];
  for (const column of [...desired].sort((a, b) => a.position - b.position)) {
    const byStudio = existing.find((row) => row.studioColumnId === column.id && !used.has(row.id));
    const bySystem = column.systemKey
      ? existing.find((row) => row.systemKey === column.systemKey && !used.has(row.id))
      : undefined;
    const match = byStudio ?? bySystem;
    if (match) {
      used.add(match.id);
      update.push({
        id: match.id,
        name: column.name,
        position: column.position,
        systemKey: column.systemKey,
        studioColumnId: column.id,
      });
    } else {
      insert.push({
        name: column.name,
        position: column.position,
        systemKey: column.systemKey,
        studioColumnId: column.id,
      });
    }
  }
  const fallbackId = update.find((row) => row.systemKey === "todo")?.id ?? update[0]?.id ?? null;
  const remove = existing
    .filter((row) => !used.has(row.id))
    .map((row) => ({
      id: row.id,
      moveTasksToId: fallbackId && fallbackId !== row.id ? fallbackId : update.find((item) => item.id !== row.id)?.id ?? null,
    }));
  return { update, insert, remove };
}
