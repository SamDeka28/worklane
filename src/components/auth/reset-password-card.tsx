"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/shared/db/supabase/browser";

const RESEND_COOLDOWN = 60;

export function ResetPasswordCard({
  defaultEmail,
  onBack,
}: {
  defaultEmail?: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(target: string) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return false;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(target);
    if (error) {
      setMessage(error.message);
      return false;
    }
    setCooldown(RESEND_COOLDOWN);
    return true;
  }

  async function onRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = email.trim();
    setPending(true);
    setMessage(null);
    const ok = await sendCode(target);
    setPending(false);
    if (!ok) return;
    setSentTo(target);
    toast.success("Check your email", {
      description: `If an account exists for ${target}, we sent a reset code.`,
    });
  }

  async function onReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentTo) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("new_password") ?? "");
    if (password !== String(data.get("confirm_new_password") ?? "")) {
      setMessage("Passwords don't match.");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }
    setPending(true);
    setMessage(null);

    if (!verified) {
      const { data: otp, error } = await supabase.auth.verifyOtp({
        email: sentTo,
        token: code.trim(),
        type: "recovery",
      });
      if (error || !otp.session) {
        setMessage(error?.message ?? "That code didn't work. Try again or resend it.");
        setPending(false);
        return;
      }
      setVerified(true);
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setPending(false);
      return;
    }
    toast.success("Password updated", { description: "You're signed in." });
    router.replace("/onboarding");
    router.refresh();
  }

  async function onResend() {
    if (!sentTo) return;
    setMessage(null);
    if (await sendCode(sentTo)) {
      toast.success("New code sent", { description: `Check ${sentTo}.` });
    }
  }

  const heading = (
    <>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-[1.85rem]">
        Reset password
      </h1>
      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
        {sentTo ? (
          <>
            Enter the code we sent to{" "}
            <span className="font-medium text-foreground">{sentTo}</span> and choose a new
            password.
          </>
        ) : (
          "We'll email you a code to reset your password."
        )}
      </p>
    </>
  );

  if (!sentTo) {
    return (
      <div className="w-full">
        {heading}
        <form className="mt-8 flex flex-col gap-4" onSubmit={onRequest}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset_email" className="text-[13px] text-muted-foreground">
              Email
            </Label>
            <Input
              id="reset_email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus
              required
              placeholder="you@studio.com"
              className="h-11"
            />
          </div>
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <Button type="submit" disabled={pending} className="mt-1 h-11 font-semibold">
            {pending ? "Sending…" : "Send reset code"}
          </Button>
        </form>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 text-[13px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {heading}
      <form className="mt-8 flex flex-col gap-4" onSubmit={onReset}>
        {verified ? null : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reset_code" className="text-[13px] text-muted-foreground">
              Reset code
            </Label>
            <Input
              id="reset_code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 10));
                setMessage(null);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              minLength={6}
              maxLength={10}
              placeholder="123456"
              className="h-11 text-center font-mono text-lg tracking-[0.4em]"
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new_password" className="text-[13px] text-muted-foreground">
            New password
          </Label>
          <PasswordInput
            id="new_password"
            name="new_password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm_new_password" className="text-[13px] text-muted-foreground">
            Confirm new password
          </Label>
          <PasswordInput
            id="confirm_new_password"
            name="confirm_new_password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Re-enter your new password"
            className="h-11"
          />
        </div>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button
          type="submit"
          disabled={pending || (!verified && code.length < 6)}
          className="mt-1 h-11 font-semibold"
        >
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-[13px]">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to sign in
        </button>
        {verified ? null : (
          <button
            type="button"
            onClick={() => void onResend()}
            disabled={cooldown > 0}
            className="font-medium text-foreground underline-offset-4 hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        )}
      </div>
    </div>
  );
}
