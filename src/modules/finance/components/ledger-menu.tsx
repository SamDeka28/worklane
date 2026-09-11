"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LedgerMenu({
  label,
  confirm,
  action,
}: {
  label: string;
  confirm: string;
  action: () => Promise<{ error?: string } | { ok?: boolean }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="More actions" disabled={pending} />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(confirm)) return;
            start(async () => {
              const result = await action();
              if ("error" in result && result.error) {
                toast.error(result.error);
                return;
              }
              toast.success(
                label.startsWith("Cancel") ? "Charge cancelled" : "Receipt undone",
              );
              router.refresh();
            });
          }}
        >
          {pending ? "Working…" : label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
