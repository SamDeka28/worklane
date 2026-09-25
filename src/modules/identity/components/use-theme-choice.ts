"use client";

import { useTheme } from "next-themes";
import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { updateThemeAction } from "@/modules/identity/appearance-actions";
import { DEFAULT_THEME } from "@/shared/theme/themes";

const SAVE_DELAY_MS = 450;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: string | null = null;

/** Shared across the page and menus so rapid picks collapse into one save. */
function persistTheme(id: string) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (lastSaved === id) return;
    const result = await updateThemeAction(id);
    if ("error" in result) {
      toast.error(`Couldn't save theme: ${result.error}`);
      return;
    }
    lastSaved = id;
  }, SAVE_DELAY_MS);
}

const subscribeNoop = () => () => {};

export function useThemeChoice(saved?: string | null) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const active = mounted
    ? (theme ?? saved ?? DEFAULT_THEME)
    : (saved ?? DEFAULT_THEME);

  const select = useCallback(
    (id: string) => {
      setTheme(id);
      persistTheme(id);
    },
    [setTheme],
  );

  return { active, select, mounted };
}
