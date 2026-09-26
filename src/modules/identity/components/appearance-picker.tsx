"use client";

import { Check, Layers, Monitor, Palette, RotateCcw, Shapes, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateAppearanceStylesAction } from "@/modules/identity/appearance-actions";
import { ThemeLivePreview } from "@/modules/identity/components/theme-live-preview";
import { useThemeChoice } from "@/modules/identity/components/use-theme-choice";
import {
  DEFAULT_THEME,
  SYSTEM_THEME,
  THEMES,
  type ThemeDefinition,
  type ThemeMode,
} from "@/shared/theme/themes";
import {
  COMPONENT_STYLES,
  DEFAULT_COMPONENT,
  DEFAULT_INTERFACE,
  DEFAULT_SURFACE,
  INTERFACE_STYLES,
  SURFACE_STYLES,
  applyAppearanceStyles,
  type AppearanceStyles,
  type ComponentStyle,
  type InterfaceStyle,
  type SurfaceStyle,
} from "@/shared/theme/styles";

function ThemePreview({ theme }: { theme: ThemeDefinition }) {
  const s = theme.swatches;
  return (
    <div
      className="flex size-full gap-1.5 p-1.5"
      style={{ backgroundColor: s.canvas }}
    >
      <div
        className="flex w-[28%] flex-col gap-1 rounded-md p-1.5"
        style={{ backgroundColor: s.shell }}
      >
        <span className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: s.primary }} />
        <span className="h-1 w-2/3 rounded-full opacity-60" style={{ backgroundColor: s.muted }} />
        <span className="h-1 w-1/2 rounded-full opacity-60" style={{ backgroundColor: s.muted }} />
        <span className="h-1 w-3/5 rounded-full opacity-60" style={{ backgroundColor: s.muted }} />
      </div>
      <div
        className="flex flex-1 flex-col gap-1 rounded-md p-1.5"
        style={{ backgroundColor: s.card }}
      >
        <span className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: s.foreground }} />
        <span className="h-1 w-4/5 rounded-full opacity-50" style={{ backgroundColor: s.muted }} />
        <span className="h-1 w-3/5 rounded-full opacity-50" style={{ backgroundColor: s.muted }} />
        <div className="mt-auto flex items-center gap-1">
          {s.accents.map((color) => (
            <span key={color} className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
          ))}
          <span
            className="ml-auto h-2 w-6 rounded-full"
            style={{ backgroundImage: `linear-gradient(90deg, ${s.primary}, ${s.accents[0]})` }}
          />
        </div>
      </div>
    </div>
  );
}

function SystemPreview() {
  const light = THEMES.find((t) => t.id === "light")!;
  const dark = THEMES.find((t) => t.id === "dark")!;
  return (
    <div className="relative size-full">
      <div className="absolute inset-0">
        <ThemePreview theme={light} />
      </div>
      <div
        className="absolute inset-0"
        style={{ clipPath: "polygon(62% 0, 100% 0, 100% 100%, 38% 100%)" }}
      >
        <ThemePreview theme={dark} />
      </div>
      <span className="absolute bottom-1.5 left-1.5 grid size-5 place-items-center rounded-md bg-black/55 text-white">
        <Monitor className="size-3" />
      </span>
    </div>
  );
}

/** A tiny scene drawn with the real appearance CSS, so each option shows exactly what it does. */
function StyleScene({
  themeId,
  surface,
  component,
  style,
}: {
  themeId: string;
  surface: SurfaceStyle;
  component: ComponentStyle;
  style: InterfaceStyle;
}) {
  return (
    <div
      data-theme={themeId}
      data-surface={surface}
      data-shape={component}
      data-style={style}
      className="lane-app relative flex size-full p-2.5 text-foreground"
    >
      {style === "glass" ? (
        <>
          <span className="absolute top-1/4 left-[18%] size-12 rounded-full bg-primary/70 blur-md" />
          <span className="absolute right-[14%] bottom-[12%] size-14 rounded-full bg-[color:var(--gradient-to,var(--lane-magenta))] opacity-70 blur-md" />
        </>
      ) : null}
      <div data-variant="open" className="lane-work relative flex flex-1 flex-col gap-2 p-2">
        <span className="h-1.5 w-2/5 rounded-full bg-foreground/45" />
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div className="flex flex-col justify-between rounded-lg bg-card p-2 lane-ring">
            <span className="h-1 w-3/4 rounded-full bg-foreground/35" />
            <span className="lane-gradient h-1.5 w-1/2 rounded-full" />
          </div>
          <div className="flex flex-col justify-between rounded-lg bg-card p-2 lane-ring">
            <span className="h-1 w-2/3 rounded-full bg-foreground/35" />
            <div className="flex gap-1">
              <span
                style={{ borderRadius: "var(--shape-control)" }}
                className="h-2.5 flex-1 bg-inset ring-1 ring-border"
              />
              <span style={{ borderRadius: "var(--shape-control)" }} className="h-2.5 w-5 bg-primary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StyleCard({
  label,
  description,
  checked,
  onSelect,
  onPreview,
  children,
}: {
  label: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
  onPreview: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
      onFocus={() => onPreview(true)}
      onBlur={() => onPreview(false)}
      className={cn(
        "group flex flex-col gap-2 rounded-2xl p-1.5 text-left outline-none transition-[box-shadow,background-color,transform] duration-200",
        "focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "bg-primary/[0.08] ring-2 ring-primary"
          : "bg-card/60 ring-1 ring-border hover:-translate-y-0.5 hover:bg-card hover:shadow-soft hover:ring-foreground/15",
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl ring-1 ring-black/5">
        {children}
        {checked ? (
          <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Check className="size-3" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <div className="px-1 pb-0.5">
        <p className="truncate text-[13px] font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

type Tab = "theme" | "style" | "surface" | "components";

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: "theme", label: "Theme", icon: Palette },
  { id: "style", label: "Style", icon: Sparkles },
  { id: "surface", label: "Surface", icon: Layers },
  { id: "components", label: "Components", icon: Shapes },
];

type Option = {
  id: string;
  label: string;
  description: string;
  mode: ThemeMode | "system";
  theme?: ThemeDefinition;
};

export function AppearancePicker({
  saved,
  savedSurface,
  savedComponent,
  savedInterface,
}: {
  saved: string | null;
  savedSurface: SurfaceStyle;
  savedComponent: ComponentStyle;
  savedInterface: InterfaceStyle;
}) {
  const { active, select } = useThemeChoice(saved);
  const { systemTheme } = useTheme();
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("theme");
  const [styles, setStyles] = useState<AppearanceStyles>({
    surface: savedSurface,
    component: savedComponent,
    interface: savedInterface,
  });
  const [hoveredStyles, setHoveredStyles] = useState<Partial<AppearanceStyles>>({});
  const shown: AppearanceStyles = { ...styles, ...hoveredStyles };

  async function saveStyles(input: Partial<AppearanceStyles>) {
    const result = await updateAppearanceStylesAction(input);
    if ("error" in result) {
      toast.error(`Couldn't save appearance: ${result.error}`);
      return;
    }
    router.refresh();
  }

  function chooseStyle<K extends keyof AppearanceStyles>(key: K, id: AppearanceStyles[K]) {
    if (styles[key] === id) return;
    const next = { ...styles, [key]: id };
    setStyles(next);
    applyAppearanceStyles(next);
    void saveStyles({ [key]: id });
  }

  const isDefault =
    active === DEFAULT_THEME &&
    styles.surface === DEFAULT_SURFACE &&
    styles.component === DEFAULT_COMPONENT &&
    styles.interface === DEFAULT_INTERFACE;

  function resetToDefaults() {
    const next: AppearanceStyles = {
      surface: DEFAULT_SURFACE,
      component: DEFAULT_COMPONENT,
      interface: DEFAULT_INTERFACE,
    };
    setStyles(next);
    setHoveredStyles({});
    setHovered(null);
    applyAppearanceStyles(next);
    if (active !== DEFAULT_THEME) select(DEFAULT_THEME);
    void saveStyles(next);
    toast.success("Appearance reset to defaults");
  }

  function previewStyle<K extends keyof AppearanceStyles>(key: K, id: AppearanceStyles[K] | null) {
    setHoveredStyles((prev) => {
      const next = { ...prev };
      if (id === null) delete next[key];
      else next[key] = id;
      return next;
    });
  }
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());

  const options = useMemo<Option[]>(() => {
    const all: Option[] = [
      {
        id: SYSTEM_THEME,
        label: "System",
        description: "Match your device, light or dark",
        mode: "system",
      },
      ...THEMES.map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        mode: t.mode,
        theme: t,
      })),
    ];
    return all;
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const ids = options.map((o) => o.id);
    const current = Math.max(0, ids.indexOf(active));
    let next = current;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ids.length - 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (current + 1) % ids.length;
    else next = (current - 1 + ids.length) % ids.length;
    const id = ids[next];
    select(id);
    optionRefs.current.get(id)?.focus();
  }

  const focusable = options.some((o) => o.id === active) ? active : options[0]?.id;

  const activeTheme =
    active === SYSTEM_THEME ? (systemTheme === "light" ? "light" : "dark") : active;
  const previewId = hovered ?? active;
  const previewTheme =
    previewId === SYSTEM_THEME
      ? (systemTheme === "light" ? "light" : "dark")
      : previewId;
  const previewMeta =
    previewId === SYSTEM_THEME
      ? { label: "System", description: "Matches your device, light or dark", mode: "Auto" }
      : (() => {
          const t = THEMES.find((x) => x.id === previewId);
          return {
            label: t?.label ?? "Theme",
            description: t?.description ?? "",
            mode: t?.mode === "light" ? "Light" : "Dark",
          };
        })();

  const groups: { label: string; hint: string; items: Option[] }[] = [
    {
      label: "Worklane",
      hint: "Our signature palettes",
      items: options.filter((o) => o.mode === "system" || o.id === "dark" || o.id === "light"),
    },
    {
      label: "Dark",
      hint: "For late nights and focus",
      items: options.filter((o) => o.mode === "dark" && o.id !== "dark"),
    },
    {
      label: "Light",
      hint: "Bright and airy",
      items: options.filter((o) => o.mode === "light" && o.id !== "light"),
    },
  ];
  const previewSwatches =
    THEMES.find((t) => t.id === previewTheme)?.swatches ?? THEMES[0].swatches;

  const styleSections: Record<
    Exclude<Tab, "theme">,
    {
      key: keyof AppearanceStyles;
      title: string;
      hint: string;
      options: { id: string; label: string; description: string }[];
    }
  > = {
    style: {
      key: "interface",
      title: "Interface style",
      hint: "The material every card is made of",
      options: INTERFACE_STYLES,
    },
    surface: {
      key: "surface",
      title: "Surface",
      hint: "The panel behind every page",
      options: SURFACE_STYLES,
    },
    components: {
      key: "component",
      title: "Components",
      hint: "Corners, buttons and fields",
      options: COMPONENT_STYLES,
    },
  };
  const section = tab === "theme" ? null : styleSections[tab];

  return (
    <div className="grid w-full gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:items-start 2xl:gap-10">
      <div className="order-2 flex min-w-0 flex-col gap-6 xl:order-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Appearance settings"
          className="-mx-1 flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-muted/60 p-1 ring-1 ring-border/60 sm:mx-0 sm:w-fit"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-[background-color,box-shadow,color]",
                tab === id
                  ? "bg-card text-foreground shadow-soft ring-1 ring-border/60"
                  : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", tab === id && "text-primary")} aria-hidden />
              {label}
            </button>
          ))}
        </div>
          <button
            type="button"
            onClick={resetToDefaults}
            disabled={isDefault}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset to defaults
          </button>
        </div>

        {section ? (
          <section className="flex flex-col gap-3" role="radiogroup" aria-label={section.title}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">{section.title}</h2>
              <p className="text-xs text-muted-foreground">{section.hint}</p>
            </div>
            <div
              className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3"
              onPointerLeave={() => previewStyle(section.key, null)}
            >
              {section.options.map((option) => {
                const scene = { ...styles, [section.key]: option.id } as AppearanceStyles;
                return (
                  <StyleCard
                    key={option.id}
                    label={option.label}
                    description={option.description}
                    checked={styles[section.key] === option.id}
                    onSelect={() => chooseStyle(section.key, option.id as never)}
                    onPreview={(on) => previewStyle(section.key, on ? (option.id as never) : null)}
                  >
                    <StyleScene
                      themeId={activeTheme}
                      surface={scene.surface}
                      component={scene.component}
                      style={scene.interface}
                    />
                  </StyleCard>
                );
              })}
            </div>
          </section>
        ) : null}

        {tab === "theme" ? (
        <div
          role="radiogroup"
          aria-label="Theme"
          onKeyDown={onKeyDown}
          onPointerLeave={() => setHovered(null)}
          className="flex flex-col gap-8"
        >
          {groups.map((group) => (
            <section key={group.label} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">{group.label}</h2>
                <p className="text-xs text-muted-foreground">{group.hint}</p>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(8.75rem,1fr))] gap-3">
                {group.items.map((option) => {
                  const checked = option.id === active;
                  return (
                    <button
                      key={option.id}
                      ref={(el) => {
                        if (el) optionRefs.current.set(option.id, el);
                        else optionRefs.current.delete(option.id);
                      }}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={option.id === focusable ? 0 : -1}
                      onClick={() => select(option.id)}
                      onPointerEnter={() => setHovered(option.id)}
                      onFocus={() => setHovered(option.id)}
                      onBlur={() => setHovered(null)}
                      className={cn(
                        "group flex flex-col gap-2 rounded-2xl p-1.5 text-left outline-none transition-[box-shadow,background-color,transform] duration-200",
                        "focus-visible:ring-2 focus-visible:ring-ring",
                        checked
                          ? "bg-primary/[0.08] ring-2 ring-primary"
                          : "bg-card/60 ring-1 ring-border hover:-translate-y-0.5 hover:bg-card hover:shadow-soft hover:ring-foreground/15",
                      )}
                    >
                      <div className="relative aspect-[16/10] overflow-hidden rounded-xl ring-1 ring-black/10">
                        {option.theme ? <ThemePreview theme={option.theme} /> : <SystemPreview />}
                        {checked ? (
                          <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                        ) : null}
                      </div>
                      <div className="px-1 pb-0.5">
                        <p className="truncate text-[13px] font-semibold text-foreground">{option.label}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        ) : null}
      </div>

      <section
        className="order-1 flex min-w-0 flex-col gap-5 rounded-3xl bg-card/50 p-5 lane-ring xl:sticky xl:top-0 xl:order-2 2xl:p-6"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {hovered && hovered !== active ? "Previewing" : "Current look"}
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
              <span className="truncate">{previewMeta.label}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {previewMeta.mode}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{previewMeta.description}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              INTERFACE_STYLES.find((o) => o.id === shown.interface)?.label,
              SURFACE_STYLES.find((o) => o.id === shown.surface)?.label,
              COMPONENT_STYLES.find((o) => o.id === shown.component)?.label,
            ].map((label) => (
              <span
                key={label}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <ThemeLivePreview
          themeId={previewTheme}
          surface={shown.surface}
          component={shown.component}
          style={shown.interface}
        />
        <p className="-mt-2 text-xs text-muted-foreground">Hover any option to preview it here, click to apply.</p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {(
            [
              ["Canvas", previewSwatches.canvas],
              ["Surface", previewSwatches.card],
              ["Text", previewSwatches.foreground],
              ["Accent", previewSwatches.primary],
            ] as const
          ).map(([name, color]) => (
            <span key={name} className="flex items-center gap-2">
              <span className="size-4 rounded-md ring-1 ring-foreground/15" style={{ backgroundColor: color }} />
              {name}
            </span>
          ))}
          <span className="flex items-center gap-2">
            <span
              className="h-4 w-10 rounded-md ring-1 ring-foreground/15"
              style={{
                backgroundImage: `linear-gradient(90deg, ${previewSwatches.primary}, ${previewSwatches.accents[0]})`,
              }}
            />
            Gradient
          </span>
        </div>
      </section>
    </div>
  );
}
