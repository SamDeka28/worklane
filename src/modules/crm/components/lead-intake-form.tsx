"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitLeadIntakeAction } from "@/modules/crm/intake-actions";
import type { IsoCurrency } from "@/shared/money";

export function LeadIntakeForm({
  code,
  embed,
  orgName,
  currency,
  headline,
  intro,
  askCompany,
  askPhone,
  askBudget,
}: {
  code: string;
  embed: boolean;
  orgName: string;
  currency: IsoCurrency;
  headline: string;
  intro: string;
  askCompany: boolean;
  askPhone: boolean;
  askBudget: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [startedAt] = useState(() => Date.now());

  if (sent) {
    return (
      <section
        className={cn(
          "w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-900/8",
          embed && "shadow-none ring-0",
        )}
      >
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Thanks, we’ve got it</h1>
        <p className="mt-2 text-sm text-slate-600">
          {orgName} will get back to you soon.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "w-full max-w-lg rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-900/8 sm:p-8",
        embed && "max-w-none shadow-none ring-0 sm:p-2",
      )}
    >
      <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">{orgName}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">{headline}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{intro}</p>

      <form
        className="mt-7 grid gap-5"
        action={(formData) => {
          setError(null);
          start(async () => {
            const result = await submitLeadIntakeAction(code, currency, formData);
            if ("error" in result) {
              setError(result.error);
              return;
            }
            setSent(true);
          });
        }}
      >
        <input type="hidden" name="started_at" value={startedAt} />
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name" htmlFor="intake_name" required>
            <Input id="intake_name" name="name" required autoComplete="name" maxLength={160} />
          </Field>
          <Field label="Email" htmlFor="intake_email" required>
            <Input
              id="intake_email"
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={254}
            />
          </Field>
          {askCompany ? (
            <Field label="Company" htmlFor="intake_company">
              <Input id="intake_company" name="company" autoComplete="organization" maxLength={160} />
            </Field>
          ) : null}
          {askPhone ? (
            <Field label="Phone" htmlFor="intake_phone">
              <Input id="intake_phone" name="phone" type="tel" autoComplete="tel" maxLength={40} />
            </Field>
          ) : null}
          {askBudget ? (
            <Field label={`Budget (${currency})`} htmlFor="intake_budget" className="sm:col-span-2">
              <Input id="intake_budget" name="budget" inputMode="decimal" placeholder="Approximate" />
            </Field>
          ) : null}
        </div>
        <Field label="What do you need?" htmlFor="intake_message">
          <Textarea
            id="intake_message"
            name="message"
            rows={5}
            maxLength={4000}
            placeholder="A few lines about the project, timing, and goals."
          />
        </Field>
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          <Send />
          {pending ? "Sending…" : "Send enquiry"}
        </Button>
      </form>
    </section>
  );
}
