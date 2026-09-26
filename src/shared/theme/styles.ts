export type SurfaceStyle = "tinted" | "gradient" | "solid" | "outline" | "open";
export type ComponentStyle = "fluid" | "soft" | "balanced" | "crisp" | "sharp";
export type InterfaceStyle = "clean" | "glass" | "neumorphic" | "clay" | "brutalist";

type StyleOption<T> = { id: T; label: string; description: string };

export const SURFACE_STYLES: StyleOption<SurfaceStyle>[] = [
  { id: "tinted", label: "Tinted", description: "A soft panel in your theme color" },
  { id: "gradient", label: "Gradient", description: "Your theme's two colors, washed in softly" },
  { id: "solid", label: "Solid", description: "A plain card panel" },
  { id: "outline", label: "Outline", description: "A thin frame, no fill" },
  { id: "open", label: "Open", description: "Cards float straight on the background" },
];

export const COMPONENT_STYLES: StyleOption<ComponentStyle>[] = [
  { id: "fluid", label: "Fluid", description: "Generous curves and pill buttons" },
  { id: "soft", label: "Soft", description: "Rounded cards with pill buttons" },
  { id: "balanced", label: "Balanced", description: "Soft corners, the Worklane default" },
  { id: "crisp", label: "Crisp", description: "Tight corners, flatter shadows" },
  { id: "sharp", label: "Sharp", description: "Square corners, editorial and precise" },
];

export const INTERFACE_STYLES: StyleOption<InterfaceStyle>[] = [
  { id: "clean", label: "Clean", description: "Flat cards with a soft shadow" },
  { id: "glass", label: "Glass", description: "Frosted, translucent layers" },
  { id: "neumorphic", label: "Neumorphic", description: "Soft extruded shapes, one tone" },
  { id: "clay", label: "Clay", description: "Puffy, rounded and playful" },
  { id: "brutalist", label: "Brutalist", description: "Bold outlines and hard shadows" },
];

export const DEFAULT_SURFACE: SurfaceStyle = "tinted";
export const DEFAULT_COMPONENT: ComponentStyle = "balanced";
export const DEFAULT_INTERFACE: InterfaceStyle = "clean";

const has = <T extends string>(list: StyleOption<T>[], value: unknown): value is T =>
  typeof value === "string" && list.some((o) => o.id === value);

export const isSurfaceStyle = (v: unknown): v is SurfaceStyle => has(SURFACE_STYLES, v);
export const isComponentStyle = (v: unknown): v is ComponentStyle => has(COMPONENT_STYLES, v);
export const isInterfaceStyle = (v: unknown): v is InterfaceStyle => has(INTERFACE_STYLES, v);

export const resolveSurface = (v: unknown): SurfaceStyle => (isSurfaceStyle(v) ? v : DEFAULT_SURFACE);
export const resolveComponent = (v: unknown): ComponentStyle =>
  isComponentStyle(v) ? v : DEFAULT_COMPONENT;
export const resolveInterface = (v: unknown): InterfaceStyle =>
  isInterfaceStyle(v) ? v : DEFAULT_INTERFACE;

export type AppearanceStyles = {
  surface: SurfaceStyle;
  component: ComponentStyle;
  interface: InterfaceStyle;
};

/** Keeps portals (dialogs, menus) in sync with the page, which is server-rendered with the same attributes. */
export function applyAppearanceStyles(styles: AppearanceStyles) {
  const targets = [
    document.documentElement,
    document.querySelector<HTMLElement>("[data-appearance-root]"),
  ];
  for (const el of targets) {
    if (!el) continue;
    el.dataset.surface = styles.surface;
    el.dataset.shape = styles.component;
    el.dataset.style = styles.interface;
  }
}
