import type { JSONContent } from "@tiptap/core";

export type BlockDiff = {
  /** Top-level block indexes in the new document that are new or edited. */
  changed: number[];
  /** Blocks from the previous document with no match in the new one. */
  removed: number;
};

function blockKey(node: JSONContent) {
  return JSON.stringify(node);
}

/** Longest-common-subsequence diff over top-level blocks. */
export function diffTopLevelBlocks(previous: JSONContent, next: JSONContent): BlockDiff {
  const a = (previous.content ?? []).map(blockKey);
  const b = (next.content ?? []).map(blockKey);
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? table[(i + 1) * cols + j + 1] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
    }
  }

  const matchedB = new Set<number>();
  let matched = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      matchedB.add(j);
      matched++;
      i++;
      j++;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const changed: number[] = [];
  for (let index = 0; index < b.length; index++) {
    if (!matchedB.has(index)) changed.push(index);
  }
  return { changed, removed: Math.max(0, a.length - matched - changed.length) };
}
