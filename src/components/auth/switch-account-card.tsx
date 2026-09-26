"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { switchAccountAction } from "@/modules/identity/actions";

export function SwitchAccountCard({
  currentEmail,
  targetEmail,
  inviteToken,
  confirmed,
  error,
}: {
  currentEmail: string;
  targetEmail?: string;
  inviteToken?: string;
  confirmed?: boolean;
  error?: string;
}) {
  const shown = useRef(false);

  useEffect(() => {
    if (!confirmed || shown.current) return;
    shown.current = true;
    toast.success("Email confirmed", {
      description: targetEmail ? `${targetEmail} is ready to use.` : undefined,
    });
  }, [confirmed, targetEmail]);

  const stayHref = inviteToken ? `/invite/${inviteToken}` : "/onboarding";

  return (
    <div className="w-full">
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-[1.85rem]">
        Switch account?
      </h1>
      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">{currentEmail}</span>.
        {targetEmail ? (
          <>
            {" "}
            This link is for{" "}
            <span className="font-medium text-foreground">{targetEmail}</span>.
          </>
        ) : null}
      </p>

      {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}

      <form action={switchAccountAction} className="mt-8 flex flex-col gap-3">
        <input type="hidden" name="email" value={targetEmail ?? ""} />
        <input type="hidden" name="invite" value={inviteToken ?? ""} />
        <input type="hidden" name="confirmed" value={confirmed ? "1" : ""} />
        <SwitchButton targetEmail={targetEmail} />
        <Link
          href={stayHref}
          className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
        >
          Stay signed in as {currentEmail}
        </Link>
      </form>
    </div>
  );
}

function SwitchButton({ targetEmail }: { targetEmail?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-11 font-semibold">
      {pending
        ? "Signing out…"
        : targetEmail
          ? `Sign in as ${targetEmail}`
          : "Sign in with another account"}
    </Button>
  );
}
