"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import {
  getBlockIndent,
  setBlockIndent,
  type BlockIndent,
} from "@/components/editor/indentable-blocks";
import type { PageMargins } from "@/modules/documents/components/document-page-ruler";

type DragKind = "pageLeft" | "pageRight" | "indentLeft" | "indentFirst" | "indentRight";

const PAGE_MIN = 24;
const PAGE_MAX = 140;
/** Major tick every half-inch at ~96dpi → 48px */
const TICK_PX = 48;

function clampPage(value: number) {
  return Math.min(PAGE_MAX, Math.max(PAGE_MIN, Math.round(value)));
}

/**
 * Clean Google Docs–style ruler on the page edge.
 * Markers only — no labels or section chrome inside the track.
 */
export function EditorPageRuler({
  editor,
  margins,
  onMarginsChange,
  editable = true,
}: {
  editor: Editor | null;
  margins: PageMargins;
  onMarginsChange: (next: PageMargins) => void;
  editable?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragKind | null>(null);
  const [indent, setIndent] = useState<BlockIndent>({
    indentLeft: 0,
    indentRight: 0,
    indentFirst: 0,
  });
  const [width, setWidth] = useState(0);

  const refreshIndent = useCallback(() => {
    if (!editor) return;
    setIndent(getBlockIndent(editor));
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    refreshIndent();
    editor.on("selectionUpdate", refreshIndent);
    editor.on("transaction", refreshIndent);
    return () => {
      editor.off("selectionUpdate", refreshIndent);
      editor.off("transaction", refreshIndent);
    };
  }, [editor, refreshIndent]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const contentLeft = margins.left;
  const contentRight = width > 0 ? width - margins.right : margins.left + 400;
  const leftMarker = contentLeft + indent.indentLeft;
  const firstMarker = contentLeft + indent.indentLeft + indent.indentFirst;
  const rightMarker = contentRight - indent.indentRight;

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragging || !trackRef.current || !editable) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));

      if (dragging === "pageLeft") {
        const maxLeft = Math.min(PAGE_MAX, width - margins.right - 120);
        onMarginsChange({ ...margins, left: clampPage(Math.min(x, maxLeft)) });
        return;
      }
      if (dragging === "pageRight") {
        const fromRight = rect.width - x;
        const maxRight = Math.min(PAGE_MAX, width - margins.left - 120);
        onMarginsChange({ ...margins, right: clampPage(Math.min(fromRight, maxRight)) });
        return;
      }
      if (!editor) return;

      if (dragging === "indentLeft") {
        const nextLeft = Math.max(0, x - contentLeft);
        const firstAbs = contentLeft + indent.indentLeft + indent.indentFirst;
        setBlockIndent(editor, {
          indentLeft: nextLeft,
          indentFirst: firstAbs - contentLeft - nextLeft,
        });
        return;
      }
      if (dragging === "indentFirst") {
        setBlockIndent(editor, {
          indentFirst: x - contentLeft - indent.indentLeft,
        });
        return;
      }
      if (dragging === "indentRight") {
        setBlockIndent(editor, {
          indentRight: Math.max(0, contentRight - x),
        });
      }
    },
    [
      contentLeft,
      contentRight,
      dragging,
      editable,
      editor,
      indent.indentFirst,
      indent.indentLeft,
      margins,
      onMarginsChange,
      width,
    ],
  );

  useEffect(() => {
    if (!dragging) return;
    const up = () => setDragging(null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [dragging]);

  const majorTicks: number[] = [];
  if (width > 0) {
    for (let x = 0; x <= width + 0.5; x += TICK_PX) majorTicks.push(x);
  }

  return (
    <div
      ref={trackRef}
      className="relative h-6 w-full touch-none select-none border-b border-black/10 bg-[#e8e6df]"
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(null)}
      onPointerCancel={() => setDragging(null)}
    >
      {/* Margin gutters */}
      <div className="absolute inset-y-0 left-0 bg-stone-400/30" style={{ width: margins.left }} />
      <div className="absolute inset-y-0 right-0 bg-stone-400/30" style={{ width: margins.right }} />

      {/* Scale marks — absolute only, no flex “sections” */}
      {majorTicks.map((x, i) => (
        <div key={x} className="pointer-events-none absolute bottom-0" style={{ left: x }}>
          <span className="absolute bottom-2 left-0.5 text-[8px] leading-none text-stone-500">
            {i}
          </span>
          <span className="absolute bottom-0 left-0 h-2.5 w-px bg-stone-500/70" />
          {x + TICK_PX / 2 <= width ? (
            <span
              className="absolute bottom-0 h-1.5 w-px bg-stone-400/60"
              style={{ left: TICK_PX / 2 }}
            />
          ) : null}
        </div>
      ))}

      {/* Page margins */}
      <Handle
        ariaLabel="Left page margin"
        className="top-0 h-full w-1.5 -translate-x-1/2 cursor-ew-resize"
        style={{ left: margins.left }}
        active={dragging === "pageLeft"}
        disabled={!editable}
        onPointerDown={() => setDragging("pageLeft")}
      >
        <span
          className={cn(
            "absolute top-0.5 left-1/2 h-3 w-1 -translate-x-1/2 rounded-[1px] bg-stone-700",
            dragging === "pageLeft" && "bg-sky-700",
          )}
        />
      </Handle>
      <Handle
        ariaLabel="Right page margin"
        className="top-0 h-full w-1.5 translate-x-1/2 cursor-ew-resize"
        style={{ right: margins.right, left: "auto" }}
        active={dragging === "pageRight"}
        disabled={!editable}
        onPointerDown={() => setDragging("pageRight")}
      >
        <span
          className={cn(
            "absolute top-0.5 left-1/2 h-3 w-1 -translate-x-1/2 rounded-[1px] bg-stone-700",
            dragging === "pageRight" && "bg-sky-700",
          )}
        />
      </Handle>

      {/* Current block indents */}
      <Handle
        ariaLabel="First line indent"
        className="top-0 h-3 w-3 -translate-x-1/2 cursor-ew-resize"
        style={{ left: firstMarker }}
        active={dragging === "indentFirst"}
        disabled={!editable || !editor}
        onPointerDown={() => setDragging("indentFirst")}
      >
        <span
          className={cn(
            "absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[7px]",
            dragging === "indentFirst" ? "border-t-sky-800" : "border-t-sky-600",
          )}
        />
      </Handle>
      <Handle
        ariaLabel="Left indent"
        className="bottom-0.5 h-1.5 w-3 -translate-x-1/2 cursor-ew-resize rounded-[1px]"
        style={{ left: leftMarker }}
        active={dragging === "indentLeft"}
        disabled={!editable || !editor}
        onPointerDown={() => setDragging("indentLeft")}
        fill
      />
      <Handle
        ariaLabel="Right indent"
        className="bottom-0 h-3 w-3 -translate-x-1/2 cursor-ew-resize"
        style={{ left: rightMarker }}
        active={dragging === "indentRight"}
        disabled={!editable || !editor}
        onPointerDown={() => setDragging("indentRight")}
      >
        <span
          className={cn(
            "absolute left-1/2 bottom-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-x-transparent border-b-[7px]",
            dragging === "indentRight" ? "border-b-sky-800" : "border-b-sky-600",
          )}
        />
      </Handle>
    </div>
  );
}

function Handle({
  ariaLabel,
  className,
  style,
  active,
  disabled,
  onPointerDown,
  children,
  fill,
}: {
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
  active?: boolean;
  disabled?: boolean;
  onPointerDown: () => void;
  children?: React.ReactNode;
  fill?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      className={cn(
        "absolute z-20 touch-none border-0 bg-transparent p-0",
        fill && (active ? "bg-sky-800" : "bg-sky-600"),
        disabled && "pointer-events-none opacity-30",
        className,
      )}
      style={style}
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.stopPropagation();
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        onPointerDown();
      }}
    >
      {children}
    </button>
  );
}
