import type { JSONContent } from "@tiptap/core";

export function docToPlainText(doc: JSONContent | null | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === "text" && node.text) parts.push(node.text);
    if (node.type === "mention" && typeof node.attrs?.label === "string") {
      parts.push(`@${node.attrs.label}`);
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
