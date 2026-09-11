"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/modules/identity/actions";
import { cn } from "@/lib/utils";

export function SignOutButton({
  className,
  label = "Sign out",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="ghost"
        className={cn(
          "h-auto w-full justify-start gap-2.5 rounded-md px-2.5 py-2 text-sm font-normal text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <LogOut className="size-4" />
        {label}
      </Button>
    </form>
  );
}
