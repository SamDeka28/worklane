import { allowsChildren, defaultBlock, nextBlockId, type Block, type CompositionDocument } from "@/modules/documents/composition/schema";

export function findBlock(doc: CompositionDocument, id: string): Block | null {
  for (const section of doc.sections) {
    const found = findIn(section.blocks, id);
    if (found) return found;
  }
  return null;
}

function findIn(blocks: Block[], id: string): Block | null {
  for (const node of blocks) {
    if (node.id === id) return node;
    const child = node.children ? findIn(node.children, id) : null;
    if (child) return child;
  }
  return null;
}

export function mapDocument(doc: CompositionDocument, visit: (node: Block) => Block): CompositionDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((node) => mapNode(node, visit)),
    })),
  };
}

function mapNode(node: Block, visit: (node: Block) => Block): Block {
  const next = visit(node);
  if (!next.children) return next;
  return { ...next, children: next.children.map((child) => mapNode(child, visit)) };
}

export function updateBlock(doc: CompositionDocument, id: string, props: Record<string, unknown>): CompositionDocument {
  return mapDocument(doc, (node) => (node.id === id ? { ...node, props: { ...node.props, ...props } } : node));
}

export function removeBlock(doc: CompositionDocument, id: string): CompositionDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: removeFrom(section.blocks, id),
    })),
  };
}

function removeFrom(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((node) => node.id !== id)
    .map((node) => (node.children ? { ...node, children: removeFrom(node.children, id) } : node));
}

export function insertBlock(doc: CompositionDocument, type: string, parentId?: string | null): CompositionDocument {
  const created = defaultBlock(type);
  if (!parentId) {
    const sections = doc.sections.length ? doc.sections : [{ id: "s-1", blocks: [] }];
    const [first, ...rest] = sections;
    return { ...doc, sections: [{ ...first, blocks: [...first.blocks, created] }, ...rest] };
  }
  return mapDocument(doc, (node) => {
    if (node.id !== parentId || !allowsChildren(node.type)) return node;
    return { ...node, children: [...(node.children ?? []), created] };
  });
}

export function moveBlock(doc: CompositionDocument, id: string, direction: -1 | 1): CompositionDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: moveIn(section.blocks, id, direction),
    })),
  };
}

function moveIn(blocks: Block[], id: string, direction: -1 | 1): Block[] {
  const index = blocks.findIndex((node) => node.id === id);
  if (index >= 0) {
    const next = index + direction;
    if (next < 0 || next >= blocks.length) return blocks;
    const copy = blocks.slice();
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    return copy;
  }
  return blocks.map((node) => (node.children ? { ...node, children: moveIn(node.children, id, direction) } : node));
}

export function moveBefore(doc: CompositionDocument, sourceId: string, targetId: string): CompositionDocument {
  if (sourceId === targetId) return doc;
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: moveBeforeIn(section.blocks, sourceId, targetId),
    })),
  };
}

function moveBeforeIn(blocks: Block[], sourceId: string, targetId: string): Block[] {
  const sourceIndex = blocks.findIndex((node) => node.id === sourceId);
  const targetIndex = blocks.findIndex((node) => node.id === targetId);
  if (sourceIndex >= 0 && targetIndex >= 0) {
    const copy = blocks.slice();
    const [item] = copy.splice(sourceIndex, 1);
    copy.splice(copy.findIndex((node) => node.id === targetId), 0, item);
    return copy;
  }
  return blocks.map((node) => (node.children ? { ...node, children: moveBeforeIn(node.children, sourceId, targetId) } : node));
}

export function insertAfterBlock(doc: CompositionDocument, afterId: string, type: string): CompositionDocument {
  const created = defaultBlock(type);
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: insertAfter(section.blocks, afterId, created),
    })),
  };
}

export function duplicateBlock(doc: CompositionDocument, id: string): CompositionDocument {
  const source = findBlock(doc, id);
  if (!source) return doc;
  const copy = cloneBlock(source);
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: insertAfter(section.blocks, id, copy),
    })),
  };
}

function cloneBlock(node: Block): Block {
  return {
    id: nextBlockId(node.type),
    type: node.type,
    props: { ...node.props },
    ...(node.children ? { children: node.children.map(cloneBlock) } : {}),
  };
}

function insertAfter(blocks: Block[], id: string, created: Block): Block[] {
  const index = blocks.findIndex((node) => node.id === id);
  if (index >= 0) {
    const copy = blocks.slice();
    copy.splice(index + 1, 0, created);
    return copy;
  }
  return blocks.map((node) => (node.children ? { ...node, children: insertAfter(node.children, id, created) } : node));
}

export function appendBlocks(doc: CompositionDocument, blocks: Block[], placement: "append" | "start" | "replace"): CompositionDocument {
  if (placement === "replace") {
    return { ...doc, sections: [{ id: doc.sections[0]?.id ?? "s-1", blocks }] };
  }
  const sections = doc.sections.length ? doc.sections : [{ id: "s-1", blocks: [] }];
  const [first, ...rest] = sections;
  const merged = placement === "start" ? [...blocks, ...first.blocks] : [...first.blocks, ...blocks];
  return { ...doc, sections: [{ ...first, blocks: merged }, ...rest] };
}
