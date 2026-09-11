"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function JoinedStudioModal({ orgName }: { orgName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const joined = searchParams.get("joined") === "1";
  const [open, setOpen] = useState(joined);

  useEffect(() => {
    if (joined) {
      setOpen(true);
      router.refresh();
    }
  }, [joined, router]);

  function dismiss() {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("joined");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
        else setOpen(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>You&apos;ve joined {orgName}</DialogTitle>
          <DialogDescription>
            Your studio access is ready. Open Projects to see work assigned to you —
            invite access applies immediately after this welcome.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={dismiss}>
            Stay on home
          </Button>
          <Button
            type="button"
            onClick={() => {
              setOpen(false);
              const base = pathname.split("/").slice(0, 2).join("/") || pathname;
              router.replace(`${base}/projects`);
              router.refresh();
            }}
          >
            View projects
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
