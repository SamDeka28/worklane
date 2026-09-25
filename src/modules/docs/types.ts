/**
 * Inline text in doc blocks supports a tiny markup:
 * `**bold**` for UI labels, `` `code` `` for literal values,
 * and `[label](/docs/slug)` for links.
 */
export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id?: string }
  | { type: "h3"; text: string }
  | { type: "steps"; items: { title: string; body?: string }[] }
  | { type: "list"; items: string[] }
  | { type: "callout"; tone: "tip" | "note" | "warning"; title?: string; text: string }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "keys"; items: { keys: string[]; label: string }[] };

export type DocKind = "guide" | "how-to" | "reference";

export type DocCategoryId =
  | "getting-started"
  | "sell"
  | "deliver"
  | "money"
  | "team"
  | "account";

export type DocCategory = {
  id: DocCategoryId;
  title: string;
  description: string;
};

export type DocArticle = {
  slug: string;
  title: string;
  summary: string;
  category: DocCategoryId;
  kind: DocKind;
  blocks: DocBlock[];
  related?: string[];
};

export type DocHeading = { id: string; text: string };

export type DocSearchEntry = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  kind: DocKind;
  headings: string[];
};
