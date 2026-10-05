"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Copy, Trash2 } from "lucide-react";
import { diagramOf, itemsOf, tableOf, textOf, type DiagramNode } from "@/modules/documents/composition/read";
import {
  arrangeDiagram,
  clipShapes,
  fillStyle,
  findPlaced,
  insertNode,
  materializeDocument,
  placeBlock,
  removeNode,
  resizeFrame,
  solidFill,
  updateNode,
  type ShapePiece,
} from "@/modules/documents/composition/frames";
import {
  allowsChildren,
  compositionPlainText,
  nextBlockId,
  type Block,
  type BlockStyle,
  type CompositionDocument,
  type Fill,
  type FrameBox,
} from "@/modules/documents/composition/schema";
import { getDocumentTheme, pagePixels } from "@/modules/documents/composition/theme";
import { uploadFileAction } from "@/modules/files/actions";
import { cn } from "@/lib/utils";

const LIBRARY = [
  { type: "frame", name: "Frame" },
  { type: "heading", name: "Heading" },
  { type: "paragraph", name: "Text" },
  { type: "image", name: "Image" },
  { type: "button", name: "Button" },
  { type: "shape", name: "Rectangle", kind: "rect" },
  { type: "shape", name: "Ellipse", kind: "ellipse" },
  { type: "table", name: "Table" },
  { type: "diagram", name: "Diagram" },
] as const;

export function CompositionCanvas({
  value,
  editable,
  onChange,
  orgSlug,
  documentId,
}: {
  value: CompositionDocument;
  editable: boolean;
  onChange?: (next: CompositionDocument, plain: string) => void;
  orgSlug?: string;
  documentId?: string;
}) {
  const seen = useRef("");
  const [doc, setDoc] = useState(() => materializeDocument(value));
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const theme = getDocumentTheme(doc.theme.id);
  const pageSize = pagePixels(doc.page.size, doc.page.orientation);
  const page = doc.pages?.[pageIndex] ?? doc.pages?.[0];
  const primary = selected.length ? findPlaced(doc, selected[selected.length - 1]) : null;

  useEffect(() => {
    const raw = JSON.stringify(value);
    if (raw === seen.current) return;
    seen.current = raw;
    setDoc(materializeDocument(value));
    setSelected([]);
  }, [value]);

  function commit(next: CompositionDocument) {
    seen.current = JSON.stringify(next);
    setDoc(next);
    onChange?.(next, compositionPlainText(next));
  }

  function patch(id: string, update: (node: Block) => Block) {
    commit(updateNode(doc, id, update));
  }

  function add(type: string, x: number, y: number, parentId?: string, kind?: string, local = false) {
    const created = placeBlock(type, Math.max(0, x), Math.max(0, y), kind);
    const next = insertNode(doc, pageIndex, created, parentId, local);
    commit(next);
    setSelected([created.id]);
  }

  function onLibraryDrop(event: React.DragEvent, parentId?: string, local = false) {
    const type = event.dataTransfer.getData("application/x-worklane-block");
    const kind = event.dataTransfer.getData("application/x-worklane-kind");
    if (!type || !editable) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    add(type, event.clientX - rect.left, event.clientY - rect.top, parentId, kind || undefined, local);
  }

  const selectedShapes = selected
    .map((id) => findPlaced(doc, id))
    .filter((node): node is Block => Boolean(node && node.type === "shape" && node.frame));

  return (
    <div className="flex h-full min-h-0 bg-muted/50">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border/60 bg-background">
        <p className="px-3 pt-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Elements</p>
        <div className="grid grid-cols-2 gap-1.5 p-3">
          {LIBRARY.map((entry) => (
            <button
              key={`${entry.type}-${entry.name}`}
              type="button"
              draggable={editable}
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-worklane-block", entry.type);
                event.dataTransfer.setData("application/x-worklane-kind", "kind" in entry ? entry.kind : "");
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => {
                if (!editable) return;
                const kind = "kind" in entry ? entry.kind : undefined;
                const parent = primary && allowsChildren(primary.type) ? primary : null;
                if (parent) add(entry.type, 16, 16 + (parent.children?.length ?? 0) * 28, parent.id, kind, true);
                else add(entry.type, 48, 48 + (page?.blocks.length ?? 0) * 16, undefined, kind);
              }}
              className="rounded-lg border border-border/60 px-2 py-2 text-left text-xs font-medium hover:bg-muted/60"
            >
              {entry.name}
            </button>
          ))}
        </div>
        <p className="border-t border-border/60 px-3 pt-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Layers</p>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {(page?.blocks ?? []).map((node) => (
            <LayerRow key={node.id} node={node} depth={0} selected={selected} onSelect={(id) => setSelected([id])} />
          ))}
        </div>
        {editable ? (
          <button
            type="button"
            className="border-t border-border/60 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => {
              const pages = [...(doc.pages ?? []), { id: nextBlockId("p"), blocks: [] }];
              commit({ ...doc, pages, sections: pages.map((item) => ({ id: item.id, blocks: item.blocks })) });
              setPageIndex(pages.length - 1);
            }}
          >
            Add page
          </button>
        ) : null}
      </aside>

      <div className="min-w-0 flex-1 overflow-auto p-8" onMouseDown={() => setSelected([])}>
        <div className="mx-auto flex flex-col gap-8">
          {(doc.pages ?? []).map((artboard, index) => (
            <article
              key={artboard.id}
              data-artboard
              className={cn("relative shadow-[0_16px_50px_-24px_rgba(15,23,42,0.45)]", index === pageIndex && "ring-1 ring-primary/30")}
              style={{ width: pageSize.width, height: pageSize.height, ...fillStyle(artboard.background), backgroundColor: artboard.background ? undefined : "#ffffff" }}
              onMouseDown={(event) => {
                event.stopPropagation();
                setPageIndex(index);
                if (event.target === event.currentTarget) setSelected([]);
              }}
              onDragOver={(event) => editable && event.preventDefault()}
              onDrop={(event) => {
                setPageIndex(index);
                onLibraryDrop(event);
              }}
            >
              {artboard.blocks.map((node) => (
                <FrameView
                  key={node.id}
                  node={node}
                  editable={editable}
                  selected={selected}
                  connectFrom={connectFrom}
                  onSelect={(id, shift) => {
                    setPageIndex(index);
                    setSelected((current) => (shift ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id]));
                  }}
                  onChange={(id, update) => patch(id, update)}
                  onDropChild={onLibraryDrop}
                  onConnect={(nodeId) => {
                    if (!connectFrom) {
                      setConnectFrom(nodeId);
                      return;
                    }
                    if (connectFrom !== nodeId && primary?.type === "diagram") {
                      const diagram = diagramOf(primary);
                      patch(primary.id, (node) => ({ ...node, props: { ...node.props, edges: [...diagram.edges, { from: connectFrom, to: nodeId }] } }));
                    }
                    setConnectFrom(null);
                  }}
                />
              ))}
              {doc.footer.show ? (
                <p className="pointer-events-none absolute right-6 bottom-4 text-[10px]" style={{ color: theme.colors.muted }}>
                  {doc.footer.text || doc.metadata.title}
                </p>
              ) : null}
              {doc.header.show ? (
                <p className="pointer-events-none absolute top-4 left-6 text-[10px]" style={{ color: theme.colors.muted }}>
                  {doc.header.text || doc.metadata.title}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      <aside className="w-64 shrink-0 overflow-auto border-l border-border/60 bg-background p-3">
        {primary ? (
          <Appearance
            node={primary}
            editable={editable}
            orgSlug={orgSlug}
            documentId={documentId}
            onChange={(update) => patch(primary.id, update)}
            onDelete={() => {
              commit(removeNode(doc, primary.id));
              setSelected([]);
            }}
            onDuplicate={() => {
              const copy = placeBlock(primary.type, (primary.frame?.x ?? 0) + 16, (primary.frame?.y ?? 0) + 16);
              copy.props = { ...primary.props };
              copy.style = primary.style ? { ...primary.style } : undefined;
              copy.frame = { ...(primary.frame ?? copy.frame!), x: (primary.frame?.x ?? 0) + 16, y: (primary.frame?.y ?? 0) + 16 };
              commit(insertNode(doc, pageIndex, copy));
              setSelected([copy.id]);
            }}
            onClip={(op) => {
              if (selectedShapes.length < 2) return;
              const [first, second] = selectedShapes;
              const result = clipShapes(pieceOf(first), pieceOf(second), op);
              const created = placeBlock("shape", result.frame.x, result.frame.y);
              created.frame = result.frame;
              created.props = { kind: "clip", op, pieces: result.pieces, path: result.path };
              created.style = first.style ?? { fill: { type: "solid", color: "#1d4ed8" } };
              let next = removeNode(removeNode(doc, first.id), second.id);
              next = insertNode(next, pageIndex, created);
              commit(next);
              setSelected([created.id]);
            }}
            canClip={selectedShapes.length >= 2}
            onArrange={(layout) => patch(primary.id, () => arrangeDiagram(primary, layout))}
          />
        ) : (
          <PageAppearance
            fill={page?.background}
            editable={editable}
            onChange={(background) => {
              const pages = (doc.pages ?? []).map((item, index) => (index === pageIndex ? { ...item, background } : item));
              commit({ ...doc, pages, sections: pages.map((item) => ({ id: item.id, blocks: item.blocks })) });
            }}
          />
        )}
      </aside>
    </div>
  );
}

function LayerRow({ node, depth, selected, onSelect }: { node: Block; depth: number; selected: string[]; onSelect: (id: string) => void }) {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn("flex w-full rounded-md px-2 py-1 text-left text-xs", selected.includes(node.id) ? "bg-primary/10 text-primary" : "hover:bg-muted/60")}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {node.type}
      </button>
      {(node.children ?? []).map((child) => (
        <LayerRow key={child.id} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

function FrameView({
  node,
  editable,
  selected,
  connectFrom,
  onSelect,
  onChange,
  onDropChild,
  onConnect,
}: {
  node: Block;
  editable: boolean;
  selected: string[];
  connectFrom: string | null;
  onSelect: (id: string, shift: boolean) => void;
  onChange: (id: string, update: (node: Block) => Block) => void;
  onDropChild: (event: React.DragEvent, parentId?: string, local?: boolean) => void;
  onConnect: (nodeId: string) => void;
}) {
  const frame = node.frame ?? { x: 0, y: 0, w: 120, h: 40 };
  const active = selected.includes(node.id);
  const drag = useRef<{ mode: string; startX: number; startY: number; frame: FrameBox } | null>(null);

  function move(event: ReactPointerEvent, mode: string) {
    if (!editable) return;
    event.stopPropagation();
    onSelect(node.id, event.shiftKey);
    drag.current = { mode, startX: event.clientX, startY: event.clientY, frame: { ...frame } };
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
  }

  function track(event: ReactPointerEvent) {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    let next = { ...state.frame };
    if (state.mode === "move") next = { ...next, x: state.frame.x + dx, y: state.frame.y + dy };
    else {
      if (state.mode.includes("e")) next.w = Math.max(16, state.frame.w + dx);
      if (state.mode.includes("s")) next.h = Math.max(16, state.frame.h + dy);
      if (state.mode.includes("w")) {
        next.x = state.frame.x + dx;
        next.w = Math.max(16, state.frame.w - dx);
      }
      if (state.mode.includes("n")) {
        next.y = state.frame.y + dy;
        next.h = Math.max(16, state.frame.h - dy);
      }
    }
    onChange(node.id, (current) => resizeFrame(current, next));
  }

  const style: CSSProperties = {
    left: frame.x,
    top: frame.y,
    width: frame.width === "fill" ? "100%" : frame.w,
    height: frame.height === "hug" ? "auto" : frame.height === "fill" ? "100%" : frame.h,
    minHeight: frame.height === "hug" ? undefined : frame.h,
    ...fillStyle(node.style?.fill),
    border: node.style?.borderWidth ? `${node.style.borderWidth}px solid ${node.style.border ?? "#e2e8f0"}` : undefined,
    borderRadius: node.style?.radius,
    opacity: node.style?.opacity,
    padding: node.style?.padding,
    color: node.style?.color,
    fontSize: node.style?.fontSize,
    fontWeight: node.style?.bold ? 700 : undefined,
    fontStyle: node.style?.italic ? "italic" : undefined,
    textAlign: node.style?.align,
  };

  return (
    <div
      data-block={node.id}
      className={cn("absolute", active && "outline outline-2 outline-sky-500")}
      style={style}
      onMouseDown={(event) => {
        event.stopPropagation();
        onSelect(node.id, event.shiftKey);
      }}
      onDragOver={(event) => {
        if (editable && allowsChildren(node.type)) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!allowsChildren(node.type)) return;
        onDropChild(event, node.id, true);
      }}
    >
      {active && editable ? (
        <button
          type="button"
          aria-label="Move"
          className="absolute -top-3 left-1/2 z-10 h-2.5 w-8 -translate-x-1/2 cursor-grab rounded-full bg-sky-500"
          onPointerDown={(event) => move(event, "move")}
          onPointerMove={track}
          onPointerUp={() => { drag.current = null; }}
        />
      ) : null}
      {active && editable
        ? (["nw", "ne", "sw", "se"] as const).map((mode) => (
            <span
              key={mode}
              className={cn(
                "absolute z-10 size-2.5 rounded-sm bg-white ring-1 ring-sky-500",
                mode.includes("n") ? "-top-1" : "-bottom-1",
                mode.includes("w") ? "-left-1" : "-right-1",
                mode === "nw" || mode === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize",
              )}
              onPointerDown={(event) => move(event, mode)}
              onPointerMove={track}
              onPointerUp={() => { drag.current = null; }}
            />
          ))
        : null}
      <FrameBody node={node} editable={editable && active} connectFrom={connectFrom} onChange={onChange} onConnect={onConnect} />
      {(node.children ?? []).map((child) => (
        <FrameView
          key={child.id}
          node={child}
          editable={editable}
          selected={selected}
          connectFrom={connectFrom}
          onSelect={onSelect}
          onChange={onChange}
          onDropChild={onDropChild}
          onConnect={onConnect}
        />
      ))}
    </div>
  );
}

function FrameBody({
  node,
  editable,
  connectFrom,
  onChange,
  onConnect,
}: {
  node: Block;
  editable: boolean;
  connectFrom: string | null;
  onChange: (id: string, update: (node: Block) => Block) => void;
  onConnect: (nodeId: string) => void;
}) {
  if (node.type === "shape") return <ShapeBody node={node} />;
  if (node.type === "image") return <ImageBody node={node} />;
  if (node.type === "table") return <TableBody node={node} editable={editable} onChange={onChange} />;
  if (node.type === "diagram") return <DiagramBody node={node} editable={editable} connectFrom={connectFrom} onChange={onChange} onConnect={onConnect} />;
  if (node.type === "button") {
    return (
      <Editable
        value={textOf(node, "label") || "Button"}
        editable={editable}
        className="flex h-full items-center justify-center"
        onCommit={(label) => onChange(node.id, (current) => ({ ...current, props: { ...current.props, label } }))}
      />
    );
  }
  if (node.type === "frame" || node.type === "card") {
    const title = textOf(node, "title");
    if (!title && node.type === "frame") return null;
    return title ? (
      <Editable value={title} editable={editable} onCommit={(next) => onChange(node.id, (current) => ({ ...current, props: { ...current.props, title: next } }))} />
    ) : null;
  }
  if (node.type === "bullets" || node.type === "numbered" || node.type === "checklist") {
    return <div className="text-[12px]">{itemsOf(node).map((item) => <div key={item}>{item}</div>)}</div>;
  }
  const key = node.type === "card" ? "title" : "text";
  return (
    <Editable
      value={textOf(node, key) || textOf(node, "body")}
      editable={editable}
      onCommit={(text) => onChange(node.id, (current) => ({ ...current, props: { ...current.props, [key]: text } }))}
    />
  );
}

function Editable({ value, editable, onCommit, className }: { value: string; editable: boolean; onCommit: (value: string) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || focused.current || el.textContent === value) return;
    el.textContent = value;
  }, [value]);
  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      role="textbox"
      className={cn("min-h-[1em] outline-none", className)}
      onMouseDown={(event) => event.stopPropagation()}
      onFocus={() => { focused.current = true; }}
      onBlur={(event) => {
        focused.current = false;
        onCommit(event.currentTarget.textContent ?? "");
      }}
    />
  );
}

function ShapeBody({ node }: { node: Block }) {
  const kind = node.props.kind;
  const fill = solidFill(node.style?.fill, "#dbeafe");
  if (kind === "clip" && typeof node.props.path === "string") {
    const rule = node.props.op === "subtract" ? "evenodd" : "nonzero";
    return (
      <svg viewBox={`0 0 ${node.frame?.w ?? 100} ${node.frame?.h ?? 100}`} className="h-full w-full">
        <path d={node.props.path} fill={fill} fillRule={rule} />
      </svg>
    );
  }
  if (kind === "ellipse") return <div className="h-full w-full" style={{ background: fill, borderRadius: "50%" }} />;
  return <div className="h-full w-full" style={{ background: fill }} />;
}

function ImageBody({ node }: { node: Block }) {
  const src = textOf(node, "src");
  const fit = node.props.fit === "cover" ? "cover" : "contain";
  const framed = node.props.frame === "phone" || node.props.frame === "browser";
  if (!src || !/^https:\/\//.test(src)) return <div className="flex h-full items-center justify-center text-[11px] text-slate-400">{textOf(node, "alt") || "Image"}</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={textOf(node, "alt")} className={cn("h-full w-full", framed && "rounded-xl border border-slate-300 p-1")} style={{ objectFit: fit }} />
  );
}

function TableBody({ node, editable, onChange }: { node: Block; editable: boolean; onChange: (id: string, update: (node: Block) => Block) => void }) {
  const table = tableOf(node);
  return (
    <table className="h-full w-full border-collapse text-left text-[11px]">
      <thead>
        <tr>
          {table.columns.map((column) => (
            <th key={column.key} className="border-b px-1 py-1">{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={`${node.id}-${rowIndex}`}>
            {table.columns.map((column) => (
              <td key={column.key} className="border-b px-1 py-1">
                <Editable
                  value={row[column.key] ?? ""}
                  editable={editable}
                  onCommit={(text) => onChange(node.id, (current) => {
                    const rows = table.rows.map((entry, index) => index === rowIndex ? { ...entry, [column.key]: text } : entry);
                    return { ...current, props: { ...current.props, rows } };
                  })}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiagramBody({
  node,
  editable,
  connectFrom,
  onChange,
  onConnect,
}: {
  node: Block;
  editable: boolean;
  connectFrom: string | null;
  onChange: (id: string, update: (node: Block) => Block) => void;
  onConnect: (nodeId: string) => void;
}) {
  const diagram = diagramOf(node);
  const nodes = diagram.nodes.map((item, index) => ({
    ...item,
    x: item.x ?? 16 + index * 140,
    y: item.y ?? 24,
    w: item.w ?? 120,
    h: item.h ?? 48,
  }));
  return (
    <div className="relative h-full w-full">
      <svg className="absolute inset-0 h-full w-full">
        {diagram.edges.map((edge) => {
          const from = nodes.find((item) => item.id === edge.from);
          const to = nodes.find((item) => item.id === edge.to);
          if (!from || !to) return null;
          return <line key={`${edge.from}-${edge.to}`} x1={from.x + from.w / 2} y1={from.y + from.h} x2={to.x + to.w / 2} y2={to.y} stroke="#1d4ed8" strokeWidth={1.4} />;
        })}
      </svg>
      {nodes.map((item) => (
        <div
          key={item.id}
          className={cn("absolute rounded-md border border-sky-700 bg-sky-100 px-2 py-1 text-[11px] font-semibold", connectFrom === item.id && "ring-2 ring-sky-500")}
          style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
          onPointerDown={(event) => {
            if (!editable) return;
            event.stopPropagation();
            const startX = event.clientX;
            const startY = event.clientY;
            const origin = { x: item.x, y: item.y };
            const move = (pointer: PointerEvent) => {
              const x = origin.x + pointer.clientX - startX;
              const y = origin.y + pointer.clientY - startY;
              onChange(node.id, (current) => writeNodes(current, nodes.map((entry) => entry.id === item.id ? { ...entry, x, y } : entry)));
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onConnect(item.id);
          }}
        >
          <Editable
            value={item.label}
            editable={editable}
            onCommit={(label) => onChange(node.id, (current) => writeNodes(current, nodes.map((entry) => entry.id === item.id ? { ...entry, label } : entry)))}
          />
        </div>
      ))}
    </div>
  );
}

function writeNodes(node: Block, nodes: DiagramNode[]): Block {
  return { ...node, props: { ...node.props, nodes } };
}

function pieceOf(node: Block): ShapePiece {
  const frame = node.frame ?? { x: 0, y: 0, w: 80, h: 48 };
  return { kind: node.props.kind === "ellipse" ? "ellipse" : "rect", x: frame.x, y: frame.y, w: frame.w, h: frame.h };
}

function Appearance({
  node,
  editable,
  orgSlug,
  documentId,
  onChange,
  onDelete,
  onDuplicate,
  onClip,
  canClip,
  onArrange,
}: {
  node: Block;
  editable: boolean;
  orgSlug?: string;
  documentId?: string;
  onChange: (update: (node: Block) => Block) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClip: (op: "union" | "subtract" | "intersect") => void;
  canClip: boolean;
  onArrange: (layout: "stack" | "row" | "hub" | "timeline") => void;
}) {
  const style = node.style ?? {};
  const frame = node.frame;
  function setStyle(patch: Partial<BlockStyle>) {
    onChange((current) => ({ ...current, style: { ...current.style, ...patch } }));
  }
  function setFrame(patch: Partial<FrameBox>) {
    onChange((current) => resizeFrame(current, { ...(current.frame ?? { x: 0, y: 0, w: 80, h: 40 }), ...patch }));
  }
  const fill = style.fill?.type === "solid" ? style.fill.color : "#ffffff";
  return (
    <div className="grid gap-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold capitalize">{node.type}</p>
        {editable ? (
          <span className="flex gap-1">
            <button type="button" aria-label="Duplicate" onClick={onDuplicate} className="rounded-md p-1 hover:bg-muted"><Copy className="size-3.5" /></button>
            <button type="button" aria-label="Delete" onClick={onDelete} className="rounded-md p-1 hover:bg-muted"><Trash2 className="size-3.5" /></button>
          </span>
        ) : null}
      </div>
      {node.type === "heading" || node.type === "paragraph" || node.type === "quote" || node.type === "button" ? (
        <div className="flex flex-wrap gap-1">
          <button type="button" className="rounded border px-2 py-1 font-bold" onClick={() => setStyle({ bold: !style.bold })}>B</button>
          <button type="button" className="rounded border px-2 py-1 italic" onClick={() => setStyle({ italic: !style.italic })}>I</button>
          <button type="button" className="rounded border px-2 py-1" onClick={() => setStyle({ align: "left" })}>Left</button>
          <button type="button" className="rounded border px-2 py-1" onClick={() => setStyle({ align: "center" })}>Center</button>
          <button type="button" className="rounded border px-2 py-1" onClick={() => setStyle({ align: "right" })}>Right</button>
          <label className="flex items-center gap-1">Size
            <input type="number" className="w-14 rounded border px-1 py-0.5" value={style.fontSize ?? 14} onChange={(event) => setStyle({ fontSize: Number(event.target.value) })} />
          </label>
        </div>
      ) : null}
      <label className="flex items-center justify-between">Fill
        <input type="color" value={toHex(fill)} onChange={(event) => setStyle({ fill: { type: "solid", color: event.target.value } })} />
      </label>
      <label className="flex items-center justify-between">Gradient
        <input type="color" onChange={(event) => setStyle({ fill: { type: "linear", angle: 90, stops: [{ color: fill, offset: 0 }, { color: event.target.value, offset: 100 }] } })} />
      </label>
      <label className="flex items-center justify-between">Border
        <input type="color" value={toHex(style.border ?? "#e2e8f0")} onChange={(event) => setStyle({ border: event.target.value, borderWidth: style.borderWidth || 1 })} />
      </label>
      <label className="grid gap-1">Radius
        <input type="range" min={0} max={48} value={style.radius ?? 0} onChange={(event) => setStyle({ radius: Number(event.target.value) })} />
      </label>
      <label className="grid gap-1">Opacity
        <input type="range" min={0.15} max={1} step={0.05} value={style.opacity ?? 1} onChange={(event) => setStyle({ opacity: Number(event.target.value) })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>Width
          <select className="mt-1 w-full rounded border px-1 py-1" value={frame?.width ?? "fixed"} onChange={(event) => setFrame({ width: event.target.value as FrameBox["width"] })}>
            <option value="fixed">Fixed</option>
            <option value="hug">Hug</option>
            <option value="fill">Fill</option>
          </select>
        </label>
        <label>Height
          <select className="mt-1 w-full rounded border px-1 py-1" value={frame?.height ?? "fixed"} onChange={(event) => setFrame({ height: event.target.value as FrameBox["height"] })}>
            <option value="fixed">Fixed</option>
            <option value="hug">Hug</option>
            <option value="fill">Fill</option>
          </select>
        </label>
        <label>Pin X
          <select className="mt-1 w-full rounded border px-1 py-1" value={frame?.pinX ?? "left"} onChange={(event) => setFrame({ pinX: event.target.value as FrameBox["pinX"] })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label>Pin Y
          <select className="mt-1 w-full rounded border px-1 py-1" value={frame?.pinY ?? "top"} onChange={(event) => setFrame({ pinY: event.target.value as FrameBox["pinY"] })}>
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
      </div>
      {node.type === "image" ? (
        <ImageFields node={node} orgSlug={orgSlug} documentId={documentId} onChange={onChange} />
      ) : null}
      {node.type === "table" ? <TableFields node={node} onChange={onChange} /> : null}
      {node.type === "diagram" ? (
        <div className="grid gap-1">
          <button type="button" className="rounded border px-2 py-1 text-left" onClick={() => onChange((current) => {
            const diagram = diagramOf(current);
            const id = nextBlockId("n");
            return writeNodes(current, [...diagram.nodes, { id, label: "Node", x: 16, y: 16 + diagram.nodes.length * 56, w: 120, h: 44 }]);
          })}>Add node</button>
          <p className="text-muted-foreground">Click two nodes to connect them.</p>
          {(["stack", "row", "hub", "timeline"] as const).map((layout) => (
            <button key={layout} type="button" className="rounded border px-2 py-1 text-left capitalize" onClick={() => onArrange(layout)}>Arrange {layout}</button>
          ))}
        </div>
      ) : null}
      {canClip ? (
        <div className="grid gap-1">
          <p className="font-medium">Clip shapes</p>
          {(["union", "subtract", "intersect"] as const).map((op) => (
            <button key={op} type="button" className="rounded border px-2 py-1 text-left capitalize" onClick={() => onClip(op)}>{op}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ImageFields({ node, orgSlug, documentId, onChange }: { node: Block; orgSlug?: string; documentId?: string; onChange: (update: (node: Block) => Block) => void }) {
  return (
    <div className="grid gap-2">
      <label className="grid gap-1">Image URL
        <input className="rounded border px-1 py-1" value={textOf(node, "src")} onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, src: event.target.value } }))} />
      </label>
      <label className="grid gap-1">Fit
        <select className="rounded border px-1 py-1" value={String(node.props.fit ?? "contain")} onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, fit: event.target.value } }))}>
          <option value="contain">Contain</option>
          <option value="cover">Cover</option>
        </select>
      </label>
      <label className="grid gap-1">Device frame
        <select className="rounded border px-1 py-1" value={String(node.props.frame ?? "none")} onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, frame: event.target.value } }))}>
          <option value="none">None</option>
          <option value="phone">Phone</option>
          <option value="browser">Browser</option>
        </select>
      </label>
      {orgSlug && documentId ? (
        <label className="grid gap-1">Upload
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const body = new FormData();
              body.set("file", file);
              body.set("entity_type", "document_version");
              body.set("entity_id", documentId);
              body.set("visibility", "shared");
              const result = await uploadFileAction(orgSlug, body);
              if (result.url) onChange((current) => ({ ...current, props: { ...current.props, src: result.url, fileId: result.id } }));
            }}
          />
        </label>
      ) : null}
    </div>
  );
}

function TableFields({ node, onChange }: { node: Block; onChange: (update: (node: Block) => Block) => void }) {
  const table = tableOf(node);
  return (
    <div className="grid gap-1">
      <button type="button" className="rounded border px-2 py-1 text-left" onClick={() => onChange((current) => {
        const key = `c${table.columns.length + 1}`;
        return { ...current, props: { ...current.props, columns: [...table.columns, { key, label: "Column" }], rows: table.rows.map((row) => ({ ...row, [key]: "" })) } };
      })}>Add column</button>
      <button type="button" className="rounded border px-2 py-1 text-left" onClick={() => onChange((current) => ({ ...current, props: { ...current.props, rows: [...table.rows, Object.fromEntries(table.columns.map((column) => [column.key, ""]))] } }))}>Add row</button>
      <button type="button" className="rounded border px-2 py-1 text-left" onClick={() => onChange((current) => ({ ...current, props: { ...current.props, rows: table.rows.slice(0, -1) } }))}>Delete row</button>
      <button type="button" className="rounded border px-2 py-1 text-left" onClick={() => {
        const columns = table.columns.slice(0, -1);
        onChange((current) => ({ ...current, props: { ...current.props, columns } }));
      }}>Delete column</button>
    </div>
  );
}

function PageAppearance({ fill, editable, onChange }: { fill?: Fill; editable: boolean; onChange: (fill: Fill) => void }) {
  const color = fill?.type === "solid" ? fill.color : "#ffffff";
  return (
    <div className="grid gap-3 text-xs">
      <p className="font-semibold">Page</p>
      <p className="text-muted-foreground">Click the page to set its background. Drop a frame, then add elements inside it.</p>
      <label className="flex items-center justify-between">Background
        <input type="color" disabled={!editable} value={toHex(color)} onChange={(event) => onChange({ type: "solid", color: event.target.value })} />
      </label>
      <label className="flex items-center justify-between">Gradient
        <input type="color" disabled={!editable} onChange={(event) => onChange({ type: "linear", angle: 160, stops: [{ color, offset: 0 }, { color: event.target.value, offset: 100 }] })} />
      </label>
    </div>
  );
}

function toHex(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff";
}
