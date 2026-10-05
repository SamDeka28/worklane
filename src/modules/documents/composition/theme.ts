export type DocumentTheme = {
  id: string;
  version: number;
  name: string;
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
  };
  type: { display: number; h1: number; h2: number; h3: number; body: number; caption: number };
  space: { xs: number; sm: number; md: number; lg: number; xl: number };
  radius: number;
};

export const DOCUMENT_THEMES: DocumentTheme[] = [
  {
    id: "professional-blue",
    version: 1,
    name: "Professional blue",
    colors: {
      primary: "#1d4ed8",
      accent: "#dbeafe",
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#0f172a",
      muted: "#64748b",
      border: "#e2e8f0",
      success: "#15803d",
      warning: "#b45309",
      danger: "#b91c1c",
    },
    type: { display: 28, h1: 22, h2: 16, h3: 13, body: 11, caption: 9 },
    space: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 },
    radius: 10,
  },
  {
    id: "ink",
    version: 1,
    name: "Ink",
    colors: {
      primary: "#0f172a",
      accent: "#f1f5f9",
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#0f172a",
      muted: "#475569",
      border: "#e2e8f0",
      success: "#166534",
      warning: "#92400e",
      danger: "#991b1b",
    },
    type: { display: 28, h1: 22, h2: 16, h3: 13, body: 11, caption: 9 },
    space: { xs: 4, sm: 8, md: 12, lg: 20, xl: 32 },
    radius: 6,
  },
];

export function getDocumentTheme(id: string | undefined): DocumentTheme {
  return DOCUMENT_THEMES.find((theme) => theme.id === id) ?? DOCUMENT_THEMES[0];
}

export const PAGE_MM = {
  A4: { portrait: { width: 210, height: 297 }, landscape: { width: 297, height: 210 } },
  LETTER: { portrait: { width: 216, height: 279 }, landscape: { width: 279, height: 216 } },
} as const;

/** CSS pixels at 96dpi, so the canvas matches print size rather than the browser width. */
export function pagePixels(size: "A4" | "LETTER", orientation: "portrait" | "landscape") {
  const mm = PAGE_MM[size][orientation];
  return { width: Math.round((mm.width / 25.4) * 96), height: Math.round((mm.height / 25.4) * 96) };
}

/** PDF points. */
export function pagePoints(size: "A4" | "LETTER", orientation: "portrait" | "landscape") {
  const mm = PAGE_MM[size][orientation];
  return { width: Math.round((mm.width / 25.4) * 72), height: Math.round((mm.height / 25.4) * 72) };
}
