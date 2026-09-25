"use client";

import { useRouter } from "next/navigation";
import { BookOpen, LogOut, Settings, UserRound } from "lucide-react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeMenu } from "@/components/shell/theme-menu";
import { signOutAction } from "@/modules/identity/actions";

const ICON = "size-4 text-muted-foreground";

/** Shared account menu body for the header avatar and the sidebar profile button. */
export function UserMenuItems({
  base,
  display,
  email,
}: {
  base: string;
  display: string;
  email: string | null;
}) {
  const router = useRouter();
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="px-2.5 py-2.5 font-normal">
          <p className="truncate text-sm font-medium text-foreground">{display}</p>
          {email ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p> : null}
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => router.push(`${base}/profile`)}>
          <UserRound className={ICON} />
          Profile
        </DropdownMenuItem>
        <ThemeMenu base={base} />
        <DropdownMenuItem onClick={() => router.push(`${base}/settings`)}>
          <Settings className={ICON} />
          Studio settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open("/docs", "_blank", "noopener")}>
          <BookOpen className={ICON} />
          Help &amp; docs
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem
          onClick={() => {
            void signOutAction();
          }}
        >
          <LogOut className={ICON} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
}
