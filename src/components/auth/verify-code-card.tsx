"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncMyProfileAction } from "@/modules/identity/actions";
import { createBrowserSupabaseClient } from "@/shared/db/supabase/browser";

const RESEND_COOLDOWN = 60;

export function VerifyCodeCard({
  email,
  inviteToken,
  onBack,
}: {
  email: string;
  inviteToken?: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }
    setPending(true);
    setMessage(null);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });
    if (error || !data.session) {
      setMessage(error?.message ?? "That code didn't work. Try again or resend it.");
      setPending(false);
      return;
    }
    try {
      await syncMyProfileAction();
    } catch {
      // Non-blocking — onboarding works without profile sync.
    }
    toast.success("Email confirmed");
    router.replace(inviteToken ? `/invite/${inviteToken}` : "/onboarding");
    router.refresh();
  }

  async function onResend() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    setMessage(null);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      setMessage(error.message);
      return;
    }
    setCooldown(RESEND_COOLDOWN);
    toast.success("New code sent", { description: `Check ${email}.` });
  }

  return (
    <div className="w-full">
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-[1.85rem]">
        Check your email
      </h1>
      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
        Enter the code we sent to{" "}
        <span className="font-medium text-foreground">{email}</span>.
      </p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onVerify}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp" className="text-[13px] text-muted-foreground">
            Confirmation code
          </Label>
          <Input
            id="otp"
            name="otp"
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
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button
          type="submit"
          disabled={pending || code.length < 6}
          className="mt-1 h-11 font-semibold"
        >
          {pending ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-[13px]">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Use a different email
        </button>
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={cooldown > 0}
          className="font-medium text-foreground underline-offset-4 hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
