export type ThemeMode = "light" | "dark";

export type ThemeSwatches = {
  canvas: string;
  shell: string;
  card: string;
  primary: string;
  foreground: string;
  muted: string;
  accents: [string, string, string];
};

export type ThemeDefinition = {
  id: string;
  label: string;
  description: string;
  mode: ThemeMode;
  swatches: ThemeSwatches;
};

/** `light` / `dark` double as next-themes' system targets, so Worklane's own palettes keep those ids. */
export const THEMES: ThemeDefinition[] = [
  {
    id: "dark",
    label: "Worklane Dark",
    description: "Deep violet night, the default",
    mode: "dark",
    swatches: {
      canvas: "oklch(0.12 0.045 295)",
      shell: "oklch(0.16 0.04 292)",
      card: "oklch(0.18 0.035 290)",
      primary: "oklch(0.62 0.22 285)",
      foreground: "oklch(0.97 0.01 280)",
      muted: "oklch(0.7 0.025 280)",
      accents: ["oklch(0.7 0.14 250)", "oklch(0.74 0.1 210)", "oklch(0.7 0.14 320)"],
    },
  },
  {
    id: "light",
    label: "Worklane Light",
    description: "Cool slate with violet accents",
    mode: "light",
    swatches: {
      canvas: "oklch(0.945 0.018 265)",
      shell: "oklch(0.98 0.008 265)",
      card: "oklch(1 0 0)",
      primary: "oklch(0.5 0.2 275)",
      foreground: "oklch(0.22 0.035 275)",
      muted: "oklch(0.48 0.03 270)",
      accents: ["oklch(0.55 0.16 250)", "oklch(0.6 0.11 210)", "oklch(0.55 0.16 320)"],
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Ink black, indigo to sky",
    mode: "dark",
    swatches: {
      canvas: "#0b0c10",
      shell: "#111218",
      card: "#16171e",
      primary: "#7c86ff",
      foreground: "#ecedf3",
      muted: "#8e90a2",
      accents: ["#38bdf8", "#5ad1e6", "#4ade80"],
    },
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Polar night, mint to violet",
    mode: "dark",
    swatches: {
      canvas: "#070d12",
      shell: "#0c141b",
      card: "#101a22",
      primary: "#2ee6b8",
      foreground: "#e6f4f1",
      muted: "#86a3a0",
      accents: ["#8b7cff", "#22d3ee", "#4ade80"],
    },
  },
  {
    id: "volt",
    label: "Volt",
    description: "Carbon black, electric lime",
    mode: "dark",
    swatches: {
      canvas: "#0a0a0b",
      shell: "#111113",
      card: "#161618",
      primary: "#d4ff3a",
      foreground: "#f2f2f0",
      muted: "#8d8d93",
      accents: ["#3ae0a4", "#5ee7df", "#4ade80"],
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Dusky rose, coral to pink",
    mode: "dark",
    swatches: {
      canvas: "#120d0f",
      shell: "#191214",
      card: "#1f1619",
      primary: "#ff7358",
      foreground: "#f7ecee",
      muted: "#b09aa0",
      accents: ["#ff4f9a", "#5fd4c4", "#6ee7a0"],
    },
  },
  {
    id: "deep-sea",
    label: "Deep Sea",
    description: "Midnight navy, cyan to indigo",
    mode: "dark",
    swatches: {
      canvas: "#07101b",
      shell: "#0b1724",
      card: "#0f1c2c",
      primary: "#38bdf8",
      foreground: "#e2edf8",
      muted: "#8aa0b8",
      accents: ["#818cf8", "#22d3ee", "#34d399"],
    },
  },
  {
    id: "evergreen",
    label: "Evergreen",
    description: "Forest night, mint to lime",
    mode: "dark",
    swatches: {
      canvas: "#0a110f",
      shell: "#0f1815",
      card: "#131e1a",
      primary: "#34d399",
      foreground: "#e4f1ea",
      muted: "#8ca79a",
      accents: ["#a3e635", "#2dd4bf", "#4ade80"],
    },
  },
  {
    id: "orchid",
    label: "Orchid",
    description: "Plum night, pink to lavender",
    mode: "dark",
    swatches: {
      canvas: "#120c14",
      shell: "#19111b",
      card: "#1e1521",
      primary: "#f472b6",
      foreground: "#f6eaf4",
      muted: "#b09bab",
      accents: ["#a78bfa", "#67e8f9", "#4ade80"],
    },
  },
  {
    id: "mono",
    label: "Mono",
    description: "Pure grayscale, zero distraction",
    mode: "dark",
    swatches: {
      canvas: "#0a0a0a",
      shell: "#111111",
      card: "#161616",
      primary: "#f5f5f5",
      foreground: "#ededed",
      muted: "#8f8f8f",
      accents: ["#8f8f8f", "#d4d4d4", "#4ade80"],
    },
  },
  {
    id: "cloud",
    label: "Cloud",
    description: "Crisp white, electric blue",
    mode: "light",
    swatches: {
      canvas: "#eef1f6",
      shell: "#f8f9fc",
      card: "#ffffff",
      primary: "#3b5bff",
      foreground: "#111827",
      muted: "#5b6475",
      accents: ["#22b8f0", "#0891b2", "#15803d"],
    },
  },
  {
    id: "mint",
    label: "Mint",
    description: "Cool mint, teal to green",
    mode: "light",
    swatches: {
      canvas: "#ebf4f1",
      shell: "#f6fbf9",
      card: "#ffffff",
      primary: "#0d9488",
      foreground: "#0f2620",
      muted: "#52706a",
      accents: ["#22c55e", "#0891b2", "#15803d"],
    },
  },
  {
    id: "blush",
    label: "Blush",
    description: "Soft pink, rose to violet",
    mode: "light",
    swatches: {
      canvas: "#f8eff2",
      shell: "#fdf7f9",
      card: "#ffffff",
      primary: "#e5487d",
      foreground: "#2a1520",
      muted: "#7d6070",
      accents: ["#a855f7", "#0891b2", "#15803d"],
    },
  },
  {
    id: "sunrise",
    label: "Sunrise",
    description: "Soft peach, tangerine to rose",
    mode: "light",
    swatches: {
      canvas: "#f7efe8",
      shell: "#fdf8f4",
      card: "#ffffff",
      primary: "#e0552d",
      foreground: "#2a1b14",
      muted: "#7a6558",
      accents: ["#db2777", "#0e8f86", "#15803d"],
    },
  },
  {
    id: "paper",
    label: "Paper",
    description: "Warm off-white, ink-black type",
    mode: "light",
    swatches: {
      canvas: "#f3f1ec",
      shell: "#faf9f6",
      card: "#ffffff",
      primary: "#1c1a17",
      foreground: "#1c1a17",
      muted: "#6b655d",
      accents: ["#78716c", "#0f8a8a", "#15803d"],
    },
  },
];

export const SYSTEM_THEME = "system";
export const DEFAULT_THEME = "dark";

export const THEME_IDS = THEMES.map((t) => t.id);

export function isThemeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value === SYSTEM_THEME || THEME_IDS.includes(value))
  );
}
