import type { JSONContent } from "@tiptap/core";

/** Turns the text an assistant wrote into editor content. Headings use # and bullets use - or *. */
export function proseToDoc(source: string): JSONContent {
  const content: JSONContent[] = [];
  let bullets: JSONContent[] = [];
  const flush = () => {
    if (bullets.length === 0) return;
    content.push({ type: "bulletList", content: bullets });
    bullets = [];
  };
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: [{ type: "text", text: heading[2] }],
      });
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      bullets.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: bullet[1] }] }],
      });
      continue;
    }
    flush();
    content.push({ type: "paragraph", content: [{ type: "text", text: line }] });
  }
  flush();
  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

/** Reads editor content back as the same heading and bullet text. */
export function proseFromDoc(doc: JSONContent | null | undefined): string {
  if (!doc?.content) return "";
  const textOf = (node: JSONContent): string => {
    if (node.type === "text" && node.text) return node.text;
    if (node.type === "mention" && typeof node.attrs?.label === "string") return String(node.attrs.label);
    return (node.content ?? []).map(textOf).join("");
  };
  const lines: string[] = [];
  for (const node of doc.content) {
    if (node.type === "heading") {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
      lines.push(`${"#".repeat(level)} ${textOf(node)}`);
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      for (const item of node.content ?? []) lines.push(`- ${textOf(item)}`);
    } else {
      const text = textOf(node).trim();
      if (text) lines.push(text);
    }
  }
  return lines.join("\n");
}
