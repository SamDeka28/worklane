import { ACCOUNT } from "./content/account";
import { DELIVER } from "./content/deliver";
import { GETTING_STARTED } from "./content/getting-started";
import { MONEY } from "./content/money";
import { SELL } from "./content/sell";
import { TEAM } from "./content/team";
import type {
  DocArticle,
  DocBlock,
  DocCategory,
  DocCategoryId,
  DocHeading,
  DocSearchEntry,
} from "./types";

export const DOC_CATEGORIES: DocCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Set up your studio and learn how the lane fits together.",
  },
  {
    id: "sell",
    title: "Sell",
    description: "Leads, your pipeline stages, and turning wins into clients.",
  },
  {
    id: "deliver",
    title: "Deliver",
    description: "Projects, milestones, boards, hours, documents, and credentials.",
  },
  {
    id: "money",
    title: "Money",
    description: "Charges, payments, invoices, partner splits, and payouts.",
  },
  {
    id: "team",
    title: "Team & access",
    description: "Invites, roles, project teams, and client portals.",
  },
  {
    id: "account",
    title: "Account & help",
    description: "Notifications, mentions, themes, shortcuts, and security.",
  },
];

export const DOC_ARTICLES: DocArticle[] = [
  ...GETTING_STARTED,
  ...SELL,
  ...DELIVER,
  ...MONEY,
  ...TEAM,
  ...ACCOUNT,
];

const BY_SLUG = new Map(DOC_ARTICLES.map((article) => [article.slug, article]));

export const DOC_KIND_LABEL = {
  guide: "Guide",
  "how-to": "How-to",
  reference: "Reference",
} as const;

export function getDocArticle(slug: string): DocArticle | undefined {
  return BY_SLUG.get(slug);
}

export function getDocCategory(id: DocCategoryId): DocCategory {
  return DOC_CATEGORIES.find((category) => category.id === id) ?? DOC_CATEGORIES[0];
}

export function docsInCategory(id: DocCategoryId): DocArticle[] {
  return DOC_ARTICLES.filter((article) => article.category === id);
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function headingId(block: Extract<DocBlock, { type: "h2" }>): string {
  return block.id ?? slugifyHeading(block.text);
}

export function docHeadings(article: DocArticle): DocHeading[] {
  return article.blocks
    .filter((block): block is Extract<DocBlock, { type: "h2" }> => block.type === "h2")
    .map((block) => ({ id: headingId(block), text: block.text }));
}

function blockText(block: DocBlock): string {
  switch (block.type) {
    case "p":
    case "h2":
    case "h3":
      return block.text;
    case "callout":
      return `${block.title ?? ""} ${block.text}`;
    case "list":
      return block.items.join(" ");
    case "steps":
      return block.items.map((item) => `${item.title} ${item.body ?? ""}`).join(" ");
    case "table":
      return [...block.head, ...block.rows.flat()].join(" ");
    case "keys":
      return block.items.map((item) => item.label).join(" ");
  }
}

export function readingMinutes(article: DocArticle): number {
  const words = article.blocks
    .map(blockText)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function docNeighbours(slug: string): {
  prev: DocArticle | null;
  next: DocArticle | null;
} {
  const index = DOC_ARTICLES.findIndex((article) => article.slug === slug);
  return {
    prev: index > 0 ? DOC_ARTICLES[index - 1] : null,
    next: index >= 0 && index < DOC_ARTICLES.length - 1 ? DOC_ARTICLES[index + 1] : null,
  };
}

export function docNavSections(): {
  id: DocCategoryId;
  title: string;
  articles: { slug: string; title: string }[];
}[] {
  return DOC_CATEGORIES.map((category) => ({
    id: category.id,
    title: category.title,
    articles: docsInCategory(category.id).map(({ slug, title }) => ({ slug, title })),
  }));
}

export function docSearchIndex(): DocSearchEntry[] {
  return DOC_ARTICLES.map((article) => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: getDocCategory(article.category).title,
    kind: article.kind,
    headings: docHeadings(article).map((heading) => heading.text),
  }));
}
