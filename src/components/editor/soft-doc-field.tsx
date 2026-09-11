"use client";

import { useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { docToPlainText, HiddenDocFields, RichEditor } from "@/components/editor/rich-editor";
import { Field } from "@/components/studio/field";
import { cn } from "@/lib/utils";

function parseDoc(raw: string | null | undefined): JSONContent | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JSONContent;
  } catch {
    return null;
  }
}

function hasDocContent(doc: JSONContent | null | undefined): boolean {
  if (!doc || typeof doc !== "object") return false;
  let found = false;
  const walk = (node: JSONContent) => {
    if (found) return;
    if (node.type === "text" && node.text?.trim()) found = true;
    if (node.type === "image" || node.type === "mention") found = true;
    node.content?.forEach(walk);
  };
  walk(doc);
  return found;
}

function plainToDoc(plain: string): JSONContent {
  const lines = plain.split(/\n/);
  return {
    type: "doc",
    content: lines.map((line) =>
      line
        ? { type: "paragraph", content: [{ type: "text", text: line }] }
        : { type: "paragraph" },
    ),
  };
}

function seedEditorDoc(
  initialDoc?: string | Record<string, unknown> | null,
  initialPlain?: string | null,
): JSONContent | null {
  const parsed =
    typeof initialDoc === "string"
      ? parseDoc(initialDoc)
      : ((initialDoc as JSONContent | null | undefined) ?? null);
  if (hasDocContent(parsed)) return parsed;
  const plain = initialPlain?.trim();
  if (plain) return plainToDoc(plain);
  return null;
}

export function SoftDocField({
  label,
  name,
  orgSlug,
  initialDoc,
  initialPlain,
  placeholder = "Write…",
  hint,
  entityType,
  entityId,
  minHeightClassName = "min-h-24",
}: {
  label: string;
  name: string;
  orgSlug: string;
  initialDoc?: string | Record<string, unknown> | null;
  initialPlain?: string | null;
  placeholder?: string;
  hint?: string;
  entityType?: string;
  entityId?: string;
  minHeightClassName?: string;
}) {
  const seeded = seedEditorDoc(initialDoc, initialPlain);
  const [doc, setDoc] = useState<JSONContent | null>(seeded);
  const [plain, setPlain] = useState(
    () => initialPlain?.trim() || (seeded ? docToPlainText(seeded) : ""),
  );

  return (
    <Field label={label} htmlFor={name} hint={hint}>
      <div className="rounded-2xl border border-border/60 bg-background px-2 py-2">
        <RichEditor
          orgSlug={orgSlug}
          entityType={entityType}
          entityId={entityId}
          value={doc}
          placeholder={placeholder}
          minHeightClassName={minHeightClassName}
          onChange={(next, nextPlain) => {
            setDoc(next);
            setPlain(nextPlain);
          }}
        />
      </div>
      <HiddenDocFields name={name} doc={doc} plain={plain} />
    </Field>
  );
}

/** Read-only TipTap doc preview for hub cards. */
export function SoftDocPreview({
  doc,
  plain,
  className,
}: {
  doc?: Record<string, unknown> | JSONContent | null;
  plain?: string | null;
  className?: string;
}) {
  const value = seedEditorDoc(doc, plain);

  if (!value) return null;

  return (
    <RichEditor
      value={value}
      editable={false}
      minHeightClassName="min-h-0"
      className={cn("bg-transparent ring-0", className)}
    />
  );
}
