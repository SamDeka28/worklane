"use client";

import { useRouter } from "next/navigation";
import { Monitor, Palette } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeChoice } from "@/modules/identity/components/use-theme-choice";
import { SYSTEM_THEME, THEMES, type ThemeDefinition } from "@/shared/theme/themes";

function Swatch({ theme }: { theme: ThemeDefinition }) {
  return (
    <span
      aria-hidden
      className="relative grid size-4 shrink-0 place-items-center overflow-hidden rounded-[5px] ring-1 ring-foreground/15"
      style={{ backgroundColor: theme.swatches.canvas }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: theme.swatches.primary }}
      />
    </span>
  );
}

/** "Appearance" submenu for the profile menus: quick theme switch plus a link to the gallery. */
export function ThemeMenu({ base }: { base: string }) {
  const router = useRouter();
  const { active, select } = useThemeChoice();
  const current =
    active === SYSTEM_THEME
      ? "System"
      : (THEMES.find((t) => t.id === active)?.label ?? "Theme");

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="px-2.5 py-1.5">
        <Palette className="size-4 text-muted-foreground" />
        <span className="flex-1">Appearance</span>
        <span className="max-w-24 truncate text-xs text-muted-foreground">{current}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-[min(28rem,var(--available-height))] min-w-52 overflow-y-auto p-1.5">
        <DropdownMenuRadioGroup value={active} onValueChange={(value) => select(String(value))}>
          <DropdownMenuRadioItem value={SYSTEM_THEME} className="gap-2 py-1.5">
            <span
              aria-hidden
              className="grid size-4 shrink-0 place-items-center rounded-[5px] bg-muted ring-1 ring-foreground/15"
            >
              <Monitor className="size-2.5" />
            </span>
            System
          </DropdownMenuRadioItem>
          {THEMES.map((theme) => (
            <DropdownMenuRadioItem key={theme.id} value={theme.id} className="gap-2 py-1.5">
              <Swatch theme={theme} />
              {theme.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="py-1.5" onClick={() => router.push(`${base}/appearance`)}>
          Browse all themes…
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
