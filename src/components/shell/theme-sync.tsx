"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import {
  applyAppearanceStyles,
  type ComponentStyle,
  type InterfaceStyle,
  type SurfaceStyle,
} from "@/shared/theme/styles";
import { DEFAULT_THEME, isThemeId } from "@/shared/theme/themes";

/**
 * The profile is the source of truth; next-themes' localStorage is only a paint cache.
 * Accounts without a saved theme get the default rather than the last account's choice.
 */
export function ThemeSync({
  saved,
  surface,
  component,
  interfaceStyle,
}: {
  saved: string | null;
  surface: SurfaceStyle;
  component: ComponentStyle;
  interfaceStyle: InterfaceStyle;
}) {
  const { theme, setTheme } = useTheme();
  const synced = useRef<string | null>(null);

  useEffect(() => {
    const target = saved && isThemeId(saved) ? saved : DEFAULT_THEME;
    if (synced.current === target) return;
    synced.current = target;
    if (theme !== target) setTheme(target);
  }, [saved, theme, setTheme]);

  useEffect(() => {
    applyAppearanceStyles({ surface, component, interface: interfaceStyle });
  }, [surface, component, interfaceStyle]);

  return null;
}
