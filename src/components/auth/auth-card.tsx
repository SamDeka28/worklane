"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/shared/db/supabase/browser";

type AuthCardProps = {
  title: string;
  description: string;
  mode: "login" | "signup";
  inviteToken?: string;
  defaultEmail?: string;
};

export function AuthCard({
  title,
  description,
  mode,
  inviteToken,
  defaultEmail,
}: AuthCardProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isInvite = Boolean(inviteToken);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const orgName = String(data.get("org_name") ?? "").trim();

    setPending(true);
    setMessage(null);

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      setPending(false);
      return;
    }

    const origin = window.location.origin;
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${origin}/auth/callback`,
              data: isInvite
                ? {
                    skip_org: true,
                    invite_token: inviteToken,
                    full_name: orgName || undefined,
                  }
                : { org_name: orgName || "Worklane Studio" },
            },
          });

    if (result.error) {
      setMessage(result.error.message);
      setPending(false);
      return;
    }

    if (result.data.session) {
      if (inviteToken) {
        router.replace(`/invite/${inviteToken}`);
      } else {
        router.replace("/onboarding");
      }
      router.refresh();
      return;
    }

    setMessage(
      isInvite
        ? "Check your email to confirm, then open the invite link again."
        : "Check your email to confirm this account, then sign in.",
    );
    setPending(false);
  }

  const otherHref = isInvite
    ? mode === "login"
      ? `/signup?invite=${encodeURIComponent(inviteToken!)}&email=${encodeURIComponent(defaultEmail ?? "")}`
      : `/login?invite=${encodeURIComponent(inviteToken!)}&email=${encodeURIComponent(defaultEmail ?? "")}`
    : mode === "login"
      ? "/signup"
      : "/login";

  return (
    <div className="w-full">
      <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <form className="mt-8 flex flex-col gap-5" onSubmit={onSubmit}>
        {mode === "signup" && !isInvite ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="org_name">Studio name</Label>
            <Input
              id="org_name"
              name="org_name"
              autoComplete="organization"
              placeholder="Worklane Studio"
              suppressHydrationWarning
            />
          </div>
        ) : null}
        {mode === "signup" && isInvite ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="org_name">Your name</Label>
            <Input
              id="org_name"
              name="org_name"
              autoComplete="name"
              placeholder="Alex"
              suppressHydrationWarning
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={defaultEmail ?? ""}
            readOnly={Boolean(defaultEmail && isInvite)}
            suppressHydrationWarning
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
            suppressHydrationWarning
          />
        </div>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button type="submit" disabled={pending} className="h-10">
          {pending
            ? "Working…"
            : mode === "login"
              ? isInvite
                ? "Sign in to accept"
                : "Sign in"
              : isInvite
                ? "Create account & continue"
                : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href={otherHref} className="text-foreground underline-offset-4 hover:underline">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already here?{" "}
            <Link href={otherHref} className="text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
