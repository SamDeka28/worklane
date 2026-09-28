"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/studio/field";
import {
  deleteSmtpSenderAction,
  saveSmtpSenderAction,
  sendSmtpTestAction,
} from "@/modules/email-senders/actions";
import {
  SMTP_PRESETS,
  type SmtpScope,
  type SmtpSecurity,
  type SmtpSenderSummary,
} from "@/modules/email-senders/types";

function presetFor(host: string) {
  return SMTP_PRESETS.find((preset) => preset.host && preset.host === host) ?? SMTP_PRESETS.at(-1)!;
}

/** Connects an SMTP mailbox for the whole studio or for one member. */
export function SmtpSenderForm({
  orgSlug,
  scope,
  saved,
  fallback,
  unavailable,
  defaultFromName,
  memberId,
  startEditing = false,
  onDone,
}: {
  orgSlug: string;
  scope: SmtpScope;
  /** A teammate's mailbox, managed by an owner or admin. */
  memberId?: string;
  startEditing?: boolean;
  onDone?: () => void;
  saved: SmtpSenderSummary | null;
  /** What sends when nothing is saved here, e.g. "the studio's account". */
  fallback: string;
  /** Why accounts can't be saved on this server, if they can't. */
  unavailable: string | null;
  defaultFromName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(startEditing);
  const [preset, setPreset] = useState(() => presetFor(saved?.host ?? "").id);
  const [host, setHost] = useState(saved?.host ?? "");
  const [port, setPort] = useState(String(saved?.port ?? 587));
  const [security, setSecurity] = useState<SmtpSecurity>(saved?.security ?? "starttls");
  const [username, setUsername] = useState(saved?.username ?? "");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(saved?.fromEmail ?? "");
  const [fromName, setFromName] = useState(saved?.fromName ?? defaultFromName);
  const hint = SMTP_PRESETS.find((item) => item.id === preset)?.hint;
  const idPrefix = `smtp_${memberId ?? scope}`;

  function pickPreset(id: string) {
    setPreset(id);
    const next = SMTP_PRESETS.find((item) => item.id === id);
    if (!next || next.id === "custom") return;
    setHost(next.host);
    setPort(String(next.port));
    setSecurity(next.security);
  }

  function save() {
    start(async () => {
      const result = await saveSmtpSenderAction(orgSlug, scope, {
        host,
        port: Number(port),
        security,
        username,
        password,
        fromEmail: fromEmail || (username.includes("@") ? username : ""),
        fromName,
      }, memberId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Connected. Emails now go out from this account.");
      setPassword("");
      setEditing(false);
      onDone?.();
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const result = await deleteSmtpSenderAction(orgSlug, scope, memberId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed. Emails fall back to ${fallback}.`);
      setEditing(false);
      onDone?.();
      router.refresh();
    });
  }

  function test() {
    start(async () => {
      const result = await sendSmtpTestAction(orgSlug, scope, memberId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Test sent from ${result.via}. Check your inbox.`);
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        {saved ? (
          <p className="text-muted-foreground">
            Sending as{" "}
            <span className="font-medium text-foreground">
              {saved.fromName ? `${saved.fromName} <${saved.fromEmail}>` : saved.fromEmail}
            </span>{" "}
            through {saved.host}:{saved.port}
            {saved.verifiedAt
              ? ` · signed in ${new Date(saved.verifiedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}`
              : ""}
            .
          </p>
        ) : (
          <p className="text-muted-foreground">Not set up. Emails go out from {fallback}.</p>
        )}
        {unavailable ? <p className="text-xs text-amber-600 dark:text-amber-400">{unavailable}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !!unavailable}
            onClick={() => setEditing(true)}
          >
            {saved ? "Edit" : "Connect SMTP"}
          </Button>
          {saved ? (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={test}>
              Send test email
            </Button>
          ) : null}
          {saved ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={remove}
              className="text-destructive hover:text-destructive"
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <fieldset disabled={pending} className="grid gap-4">
        <Field label="Provider" htmlFor={`${idPrefix}_preset`} hint={hint}>
          <NativeSelect
            id={`${idPrefix}_preset`}
            value={preset}
            onChange={(event) => pickPreset(event.target.value)}
          >
            {SMTP_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem_9rem]">
          <Field label="SMTP server" htmlFor={`${idPrefix}_host`}>
            <Input
              id={`${idPrefix}_host`}
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="smtp.example.com"
              autoComplete="off"
              required
            />
          </Field>
          <Field label="Port" htmlFor={`${idPrefix}_port`}>
            <Input
              id={`${idPrefix}_port`}
              value={port}
              onChange={(event) => setPort(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              required
            />
          </Field>
          <Field label="Security" htmlFor={`${idPrefix}_security`}>
            <NativeSelect
              id={`${idPrefix}_security`}
              value={security}
              onChange={(event) => setSecurity(event.target.value as SmtpSecurity)}
            >
              <option value="ssl">SSL/TLS</option>
              <option value="starttls">STARTTLS</option>
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Username" htmlFor={`${idPrefix}_user`}>
            <Input
              id={`${idPrefix}_user`}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              required
            />
          </Field>
          <Field
            label="Password"
            htmlFor={`${idPrefix}_pass`}
            hint={saved ? "Leave blank to keep the saved password." : "Stored encrypted."}
          >
            <Input
              id={`${idPrefix}_pass`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              placeholder={saved ? "••••••••" : undefined}
              required={!saved}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From address" htmlFor={`${idPrefix}_from`} hint="Usually the same as the username.">
            <Input
              id={`${idPrefix}_from`}
              type="email"
              value={fromEmail}
              onChange={(event) => setFromEmail(event.target.value)}
              placeholder={username.includes("@") ? username : "you@studio.com"}
            />
          </Field>
          <Field label="From name" htmlFor={`${idPrefix}_from_name`}>
            <Input
              id={`${idPrefix}_from_name`}
              value={fromName}
              onChange={(event) => setFromName(event.target.value)}
            />
          </Field>
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Save and connect"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setEditing(false);
            onDone?.();
          }}
        >
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">
          We sign in once to check it works before saving.
        </span>
      </div>
    </form>
  );
}
