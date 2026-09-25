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
    id: "dark-modern",
    label: "Dark Modern",
    description: "Neutral graphite, editor classic",
    mode: "dark",
    swatches: {
      canvas: "#181818",
      shell: "#1f1f1f",
      card: "#232323",
      primary: "#0078d4",
      foreground: "#e6e6e6",
      muted: "#9d9d9d",
      accents: ["#4fc1ff", "#4ec9b0", "#c586c0"],
    },
  },
  {
    id: "github-dark",
    label: "GitHub Dark",
    description: "Midnight blue with crisp blues",
    mode: "dark",
    swatches: {
      canvas: "#0d1117",
      shell: "#151b23",
      card: "#161b22",
      primary: "#2f81f7",
      foreground: "#e6edf3",
      muted: "#8d96a0",
      accents: ["#58a6ff", "#3fb950", "#bc8cff"],
    },
  },
  {
    id: "github-light",
    label: "GitHub Light",
    description: "Clean white, familiar blue",
    mode: "light",
    swatches: {
      canvas: "#f6f8fa",
      shell: "#ffffff",
      card: "#ffffff",
      primary: "#0969da",
      foreground: "#1f2328",
      muted: "#59636e",
      accents: ["#0969da", "#1a7f37", "#8250df"],
    },
  },
  {
    id: "one-dark",
    label: "One Dark",
    description: "Atom's balanced slate",
    mode: "dark",
    swatches: {
      canvas: "#21252b",
      shell: "#282c34",
      card: "#2c313a",
      primary: "#61afef",
      foreground: "#dcdfe4",
      muted: "#9da5b4",
      accents: ["#98c379", "#e5c07b", "#c678dd"],
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    description: "Purple haze, neon accents",
    mode: "dark",
    swatches: {
      canvas: "#21222c",
      shell: "#282a36",
      card: "#2d2f3f",
      primary: "#bd93f9",
      foreground: "#f8f8f2",
      muted: "#a0a8cd",
      accents: ["#ff79c6", "#8be9fd", "#50fa7b"],
    },
  },
  {
    id: "nord",
    label: "Nord",
    description: "Arctic, north-bluish calm",
    mode: "dark",
    swatches: {
      canvas: "#2b303b",
      shell: "#2e3440",
      card: "#3b4252",
      primary: "#88c0d0",
      foreground: "#eceff4",
      muted: "#9aa5b8",
      accents: ["#81a1c1", "#a3be8c", "#b48ead"],
    },
  },
  {
    id: "monokai",
    label: "Monokai",
    description: "Warm charcoal, electric color",
    mode: "dark",
    swatches: {
      canvas: "#1e1f1c",
      shell: "#272822",
      card: "#2d2e27",
      primary: "#a6e22e",
      foreground: "#f8f8f2",
      muted: "#a59f85",
      accents: ["#f92672", "#66d9ef", "#e6db74"],
    },
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    description: "Precision teal for low light",
    mode: "dark",
    swatches: {
      canvas: "#002b36",
      shell: "#01313d",
      card: "#073642",
      primary: "#268bd2",
      foreground: "#eee8d5",
      muted: "#93a1a1",
      accents: ["#2aa198", "#b58900", "#d33682"],
    },
  },
  {
    id: "solarized-light",
    label: "Solarized Light",
    description: "Soft parchment, easy on the eyes",
    mode: "light",
    swatches: {
      canvas: "#f5efdc",
      shell: "#fdf6e3",
      card: "#fdf6e3",
      primary: "#268bd2",
      foreground: "#073642",
      muted: "#657b83",
      accents: ["#2aa198", "#b58900", "#d33682"],
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
