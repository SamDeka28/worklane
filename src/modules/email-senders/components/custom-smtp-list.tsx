"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useActionProgress as useTransition } from "@/components/studio/use-action-progress";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelectMultiple } from "@/components/ui/search-select";
import { Field } from "@/components/studio/field";
import {
  deleteCustomSmtpAction,
  saveCustomSmtpAction,
  sendCustomSmtpTestAction,
} from "@/modules/email-senders/actions";
import type { CustomMailbox } from "@/modules/email-senders/server";
import {
  SMTP_MODULES,
  SMTP_PRESETS,
  smtpModuleLabel,
  type SmtpModuleId,
  type SmtpSecurity,
} from "@/modules/email-senders/types";

function presetFor(host: string) {
  return SMTP_PRESETS.find((preset) => preset.host && preset.host === host) ?? SMTP_PRESETS.at(-1)!;
}

export function CustomSmtpList({
  orgSlug,
  mailboxes,
  members,
  unavailable,
  defaultFromName,
}: {
  orgSlug: string;
  mailboxes: CustomMailbox[];
  members: { userId: string; name: string }[];
  unavailable: string | null;
  defaultFromName: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-8 grid gap-4 border-t border-border/50 pt-6">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Custom mailboxes</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Assign a mailbox to teammates and choose which modules send through it. The studio mailbox
          above is used when nobody is assigned.
        </p>
      </div>
      {unavailable ? <p className="text-xs text-amber-600 dark:text-amber-400">{unavailable}</p> : null}
      {mailboxes.map((mailbox) => (
        <CustomSmtpCard
          key={mailbox.id}
          orgSlug={orgSlug}
          mailbox={mailbox}
          members={members}
          unavailable={unavailable}
          defaultFromName={defaultFromName}
        />
      ))}
      {adding ? (
        <CustomSmtpEditor
          orgSlug={orgSlug}
          members={members}
          unavailable={unavailable}
          defaultFromName={defaultFromName}
          onDone={() => setAdding(false)}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-fit" disabled={!!unavailable} onClick={() => setAdding(true)}>
          Add mailbox
        </Button>
      )}
    </div>
  );
}

function CustomSmtpCard({
  orgSlug,
  mailbox,
  members,
  unavailable,
  defaultFromName,
}: {
  orgSlug: string;
  mailbox: CustomMailbox;
  members: { userId: string; name: string }[];
  unavailable: string | null;
  defaultFromName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const names = mailbox.memberIds.map((id) => members.find((member) => member.userId === id)?.name ?? "Former teammate");

  if (editing) {
    return (
      <CustomSmtpEditor
        orgSlug={orgSlug}
        mailbox={mailbox}
        members={members}
        unavailable={unavailable}
        defaultFromName={defaultFromName}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="grid gap-2 rounded-xl bg-muted/40 px-3 py-3 text-sm ring-1 ring-border/40">
      <p className="font-medium">{mailbox.name}</p>
      <p className="text-muted-foreground">
        Sending as{" "}
        <span className="font-medium text-foreground">
          {mailbox.fromName ? `${mailbox.fromName} <${mailbox.fromEmail}>` : mailbox.fromEmail}
        </span>{" "}
        through {mailbox.host}:{mailbox.port}.
      </p>
      <p className="text-xs text-muted-foreground">
        {mailbox.modules.map(smtpModuleLabel).join(", ") || "No modules"} · {names.join(", ") || "No teammates"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending || !!unavailable} onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await sendCustomSmtpTestAction(orgSlug, mailbox.id);
              if ("error" in result) {
                toast.error(result.error);
                return;
              }
              toast.success(`Test sent from ${result.via}. Check your inbox.`);
              router.refresh();
            })
          }
        >
          Send test email
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:text-destructive"
          onClick={() =>
            start(async () => {
              const result = await deleteCustomSmtpAction(orgSlug, mailbox.id);
              if ("error" in result) {
                toast.error(result.error);
                return;
              }
              toast.success("Removed.");
              router.refresh();
            })
          }
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

function CustomSmtpEditor({
  orgSlug,
  mailbox,
  members,
  unavailable,
  defaultFromName,
  onDone,
}: {
  orgSlug: string;
  mailbox?: CustomMailbox;
  members: { userId: string; name: string }[];
  unavailable: string | null;
  defaultFromName: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState(() => presetFor(mailbox?.host ?? "").id);
  const [name, setName] = useState(mailbox?.name ?? "");
  const [host, setHost] = useState(mailbox?.host ?? "");
  const [port, setPort] = useState(String(mailbox?.port ?? 587));
  const [security, setSecurity] = useState<SmtpSecurity>(mailbox?.security ?? "starttls");
  const [username, setUsername] = useState(mailbox?.username ?? "");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(mailbox?.fromEmail ?? "");
  const [fromName, setFromName] = useState(mailbox?.fromName ?? defaultFromName);
  const [modules, setModules] = useState<SmtpModuleId[]>(() =>
    (mailbox?.modules ?? []).filter((id): id is SmtpModuleId => SMTP_MODULES.some((module) => module.id === id)),
  );
  const [memberIds, setMemberIds] = useState(mailbox?.memberIds ?? []);
  const hint = SMTP_PRESETS.find((item) => item.id === preset)?.hint;
  const fieldId = (part: string) => `custom-smtp-${mailbox?.id ?? "new"}-${part}`;

  function pickPreset(id: string) {
    setPreset(id);
    const next = SMTP_PRESETS.find((item) => item.id === id);
    if (!next || next.id === "custom") return;
    setHost(next.host);
    setPort(String(next.port));
    setSecurity(next.security);
  }

  function toggleModule(id: SmtpModuleId) {
    setModules((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <form
      className="grid max-w-xl gap-4 rounded-xl bg-muted/30 p-3 ring-1 ring-border/40"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await saveCustomSmtpAction(
            orgSlug,
            {
              name,
              modules,
              memberIds,
              host,
              port: Number(port),
              security,
              username,
              password,
              fromEmail: fromEmail || (username.includes("@") ? username : ""),
              fromName,
            },
            mailbox?.id,
          );
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          toast.success("Connected. Assigned teammates will send through this mailbox.");
          onDone();
          router.refresh();
        });
      }}
    >
      <fieldset disabled={pending || !!unavailable} className="grid gap-4">
        <Field label="Name" htmlFor={fieldId("name")}>
          <Input id={fieldId("name")} value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Provider" htmlFor={fieldId("preset")} hint={hint}>
          <NativeSelect id={fieldId("preset")} value={preset} onChange={(event) => pickPreset(event.target.value)}>
            {SMTP_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem_9rem]">
          <Field label="SMTP server" htmlFor={fieldId("host")}>
            <Input id={fieldId("host")} value={host} onChange={(event) => setHost(event.target.value)} placeholder="smtp.example.com" required />
          </Field>
          <Field label="Port" htmlFor={fieldId("port")}>
            <Input id={fieldId("port")} value={port} onChange={(event) => setPort(event.target.value.replace(/\D/g, ""))} inputMode="numeric" required />
          </Field>
          <Field label="Security" htmlFor={fieldId("security")}>
            <NativeSelect id={fieldId("security")} value={security} onChange={(event) => setSecurity(event.target.value as SmtpSecurity)}>
              <option value="ssl">SSL/TLS</option>
              <option value="starttls">STARTTLS</option>
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Username" htmlFor={fieldId("user")}>
            <Input id={fieldId("user")} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" required />
          </Field>
          <Field label="Password" htmlFor={fieldId("pass")} hint={mailbox ? "Leave blank to keep the saved password." : "Stored encrypted."}>
            <Input
              id={fieldId("pass")}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder={mailbox ? "••••••••" : undefined}
              required={!mailbox}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From address" htmlFor={fieldId("from")}>
            <Input id={fieldId("from")} type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} />
          </Field>
          <Field label="From name" htmlFor={fieldId("from_name")}>
            <Input id={fieldId("from_name")} value={fromName} onChange={(event) => setFromName(event.target.value)} />
          </Field>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Modules</legend>
          <div className="flex flex-wrap gap-1.5">
            {SMTP_MODULES.map((module) => {
              const on = modules.includes(module.id);
              return (
                <button
                  key={module.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleModule(module.id)}
                  className={
                    on
                      ? "rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/30"
                      : "rounded-lg bg-background/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border/40"
                  }
                >
                  {module.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Teammates" htmlFor={fieldId("members")}>
          <SearchSelectMultiple
            id={fieldId("members")}
            options={members.map((member) => ({ value: member.userId, label: member.name }))}
            value={memberIds}
            onValueChange={setMemberIds}
            placeholder="Assign teammates"
          />
        </Field>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !!unavailable}>
          {pending ? "Signing in…" : "Save and connect"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
