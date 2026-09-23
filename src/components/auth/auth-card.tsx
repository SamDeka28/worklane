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

  function inviteCallbackUrl(origin: string) {
    return `${origin}/auth/callback?next=${encodeURIComponent(`/invite/${inviteToken}`)}`;
  }

  async function onGoogle() {
    setPending(true);
    setMessage(null);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      setPending(false);
      return;
    }
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: isInvite
          ? inviteCallbackUrl(origin)
          : `${origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
          ...(isInvite ? { skip_org: "true" } : {}),
        },
      },
    });
    if (error) {
      setMessage(error.message);
      setPending(false);
    }
  }

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
              emailRedirectTo: isInvite
                ? inviteCallbackUrl(origin)
                : `${origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
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
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-[1.85rem]">
        {title}
      </h1>
      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
        {mode === "login" ? (
          <>
            {description}{" "}
            <Link
              href={otherHref}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create one
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={otherHref}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
        {mode === "signup" && !isInvite ? (
          <Field label="Studio name" htmlFor="org_name">
            <Input
              id="org_name"
              name="org_name"
              autoComplete="organization"
              placeholder="Worklane Studio"
              className="h-11"
              suppressHydrationWarning
            />
          </Field>
        ) : null}
        {mode === "signup" && isInvite ? (
          <Field label="Your name" htmlFor="org_name">
            <Input
              id="org_name"
              name="org_name"
              autoComplete="name"
              placeholder="Alex"
              className="h-11"
              suppressHydrationWarning
            />
          </Field>
        ) : null}
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@studio.com"
            defaultValue={defaultEmail ?? ""}
            readOnly={Boolean(defaultEmail && isInvite)}
            className="h-11"
            suppressHydrationWarning
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
            placeholder="Enter your password"
            className="h-11"
            suppressHydrationWarning
          />
        </Field>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button type="submit" disabled={pending} className="mt-1 h-11 font-semibold">
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

      <div className="relative my-7 text-center text-[11px] text-muted-foreground">
        <span className="relative z-10 bg-card px-3">
          Or {mode === "login" ? "sign in" : "register"} with
        </span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={pending}
        onClick={() => void onGoogle()}
      >
        <GoogleMark />
        Google
      </Button>

      {mode === "login" ? null : (
        <p className="mt-6 text-center text-[12px] leading-5 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-[13px] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
