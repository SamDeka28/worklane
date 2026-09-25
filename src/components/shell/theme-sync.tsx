"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { isThemeId } from "@/shared/theme/themes";

/** Applies the profile's saved theme when this device's stored choice differs. */
export function ThemeSync({ saved }: { saved: string | null }) {
  const { theme, setTheme } = useTheme();
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!saved || !isThemeId(saved) || synced.current === saved) return;
    synced.current = saved;
    if (theme !== saved) setTheme(saved);
  }, [saved, theme, setTheme]);

  return null;
}
