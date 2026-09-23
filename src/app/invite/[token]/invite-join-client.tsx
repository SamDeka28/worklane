"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SoftCard } from "@/components/studio/chrome";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/modules/team/actions";

type InviteJoinClientProps = {
  token: string;
  orgName: string;
  signedInEmail: string | null;
};

/**
 * Accept runs from the client (server action), not during RSC render.
 * Mutation + redirect in a Server Component was crashing the invite page on Vercel
 * even after membership was created successfully.
 */
export function InviteJoinClient({
  token,
  orgName,
  signedInEmail,
}: InviteJoinClientProps) {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [expectedEmail, setExpectedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const result = await acceptInvitationAction(token);
        if (cancelled) return;

        if (result.ok) {
          const qs = result.alreadyAccepted ? "" : "?joined=1";
          const href = result.projectId
            ? `/${result.orgSlug}/projects/${result.projectId}${qs}`
            : `/${result.orgSlug}${qs}`;
          // Hard navigation avoids soft-router races after membership changes.
          window.location.assign(href);
          return;
        }

        setError(result.error);
        setExpectedEmail(result.expectedEmail ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong accepting the invite.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        <h1 className="font-heading text-2xl font-semibold">Couldn’t accept invite</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        {expectedEmail ? (
          <p className="mt-2 text-sm">
            Signed in as {(signedInEmail ?? "").toLowerCase()}. Switch to{" "}
            <strong>{expectedEmail}</strong>.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            nativeButton={false}
            render={<Link href={`/login?invite=${encodeURIComponent(token)}`} />}
          >
            Switch account
          </Button>
          <Button nativeButton={false} render={<Link href="/onboarding" />} variant="outline">
            Continue
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Joining studio
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        {orgName}
      </h1>
      <SoftCard className="mt-8 p-5">
        <p className="text-sm text-muted-foreground">
          Setting up your access…
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </SoftCard>
    </main>
  );
}
