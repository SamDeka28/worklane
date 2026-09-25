"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, EyeOff, Lock, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { AvatarMark } from "@/components/studio/chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  revealCredentialAction,
  saveCredentialAction,
} from "@/modules/credentials/actions";
import {
  CREDENTIAL_KINDS,
  CREDENTIAL_KIND_LABEL,
  EMPTY_SECRET,
  type CredentialKind,
  type CredentialPerson,
  type CredentialRecord,
  type CredentialSecret,
} from "@/modules/credentials/types";

const GENERATED_LENGTH = 20;
const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+";

export function generatePassword(length = GENERATED_LENGTH) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => ALPHABET[v % ALPHABET.length]).join("");
}

function PasswordInput({
  id,
  value,
  onChange,
  onGenerate,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate?: () => void;
  placeholder?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <Input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck={false}
        className="font-mono"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={shown ? "Hide" : "Show"}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOff /> : <Eye />}
      </Button>
      {onGenerate ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Generate strong password"
          title="Generate strong password"
          onClick={() => {
            onGenerate();
            setShown(true);
          }}
        >
          <RefreshCw />
        </Button>
      ) : null}
    </div>
  );
}

export function CredentialFormSheet({
  orgSlug,
  projectId,
  credential,
  team,
  always,
  open,
  onOpenChange,
}: {
  orgSlug: string;
  projectId: string;
  /** Omit to create. */
  credential?: CredentialRecord;
  team: CredentialPerson[];
  always: CredentialPerson[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const editing = Boolean(credential);
  const canManage = !credential || credential.canManage;
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(editing);
  const requested = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });
  const [name, setName] = useState(credential?.name ?? "");
  const [kind, setKind] = useState<CredentialKind>(credential?.kind ?? "login");
  const [url, setUrl] = useState(credential?.url ?? "");
  const [restricted, setRestricted] = useState(credential?.restricted ?? false);
  const [accessIds, setAccessIds] = useState<string[]>(credential?.accessUserIds ?? []);
  const [secret, setSecret] = useState<CredentialSecret>(EMPTY_SECRET);
  const [secretLoaded, setSecretLoaded] = useState(!editing);

  // Each reveal is audit-logged, so fetch the stored secret at most once per sheet.
  const credentialId = credential?.id;
  useEffect(() => {
    if (!open || !credentialId || requested.current) return;
    requested.current = true;
    revealCredentialAction(orgSlug, credentialId).then((result) => {
      setLoading(false);
      if ("error" in result) {
        toast.error(result.error);
        onOpenChangeRef.current(false);
        return;
      }
      setSecret(result.secret);
      setSecretLoaded(true);
    });
  }, [open, credentialId, orgSlug]);

  function patchSecret(patch: Partial<CredentialSecret>) {
    setSecret((prev) => ({ ...prev, ...patch }));
  }

  function patchField(index: number, patch: Partial<CredentialSecret["fields"][number]>) {
    setSecret((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  }

  function submit() {
    if (!name.trim()) {
      toast.error("Give the credential a name");
      return;
    }
    start(async () => {
      const result = await saveCredentialAction(orgSlug, projectId, {
        id: credential?.id,
        name,
        kind,
        url,
        restricted,
        accessUserIds: restricted ? accessIds : [],
        secret: secretLoaded ? secret : undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Credential updated" : "Credential saved");
      onOpenChange(false);
      router.refresh();
    });
  }

  const usernameLabel =
    kind === "api_key" ? "Key ID / client ID" : kind === "database" ? "User" : "Username or email";
  const passwordLabel =
    kind === "api_key" ? "Secret key" : kind === "server" ? "Password or private key" : "Password";

  return (
    <ActionSheet
      title={editing ? "Edit credential" : "New credential"}
      description="Encrypted before it's stored. Only people with access can reveal it."
      hideTrigger
      width="wide"
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || loading}>
            {pending ? "Saving…" : editing ? "Save changes" : "Save credential"}
          </Button>
        </div>
      }
    >
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        autoComplete="off"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="cred-name">Name</Label>
            <Input
              id="cred-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shopify admin, AWS production"
              maxLength={120}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cred-kind">Type</Label>
            <NativeSelect
              id="cred-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as CredentialKind)}
            >
              {CREDENTIAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CREDENTIAL_KIND_LABEL[k]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cred-url">URL or host</Label>
            <Input
              id="cred-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… or db.example.com:5432"
              maxLength={500}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3">
            <div className="lane-skeleton h-10 rounded-lg" />
            <div className="lane-skeleton h-10 rounded-lg" />
          </div>
        ) : (
          <div className="grid gap-4 rounded-2xl bg-muted/40 p-4 ring-1 ring-border/50">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cred-username">{usernameLabel}</Label>
                <Input
                  id="cred-username"
                  value={secret.username}
                  onChange={(e) => patchSecret({ username: e.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cred-password">{passwordLabel}</Label>
                <PasswordInput
                  id="cred-password"
                  value={secret.password}
                  onChange={(password) => patchSecret({ password })}
                  onGenerate={() => patchSecret({ password: generatePassword() })}
                />
              </div>
            </div>

            {secret.fields.length > 0 ? (
              <div className="grid gap-3">
                {secret.fields.map((field, index) => (
                  <div
                    key={index}
                    className="grid items-end gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
                  >
                    <div className="grid gap-1.5">
                      <Label htmlFor={`cred-field-label-${index}`}>Label</Label>
                      <Input
                        id={`cred-field-label-${index}`}
                        value={field.label}
                        onChange={(e) => patchField(index, { label: e.target.value })}
                        placeholder="e.g. 2FA backup"
                        maxLength={80}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`cred-field-value-${index}`}>Value</Label>
                      {field.secret ? (
                        <PasswordInput
                          id={`cred-field-value-${index}`}
                          value={field.value}
                          onChange={(value) => patchField(index, { value })}
                        />
                      ) : (
                        <Input
                          id={`cred-field-value-${index}`}
                          value={field.value}
                          onChange={(e) => patchField(index, { value: e.target.value })}
                          spellCheck={false}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1 pb-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-pressed={field.secret}
                        onClick={() => patchField(index, { secret: !field.secret })}
                        title={field.secret ? "Masked" : "Visible"}
                      >
                        {field.secret ? <Lock /> : <Eye />}
                        {field.secret ? "Hidden" : "Plain"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Remove field"
                        onClick={() =>
                          setSecret((prev) => ({
                            ...prev,
                            fields: prev.fields.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() =>
                  setSecret((prev) => ({
                    ...prev,
                    fields: [...prev.fields, { label: "", value: "", secret: true }],
                  }))
                }
              >
                <Plus /> Add field
              </Button>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cred-notes">Notes</Label>
              <Textarea
                id="cred-notes"
                value={secret.notes}
                onChange={(e) => patchSecret({ notes: e.target.value })}
                placeholder="Recovery steps, who owns the account, renewal dates…"
                rows={3}
              />
            </div>
          </div>
        )}

        {canManage ? (
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Who can see this</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  value: false,
                  title: "Everyone on this project",
                  body: "Project team and assigned partners",
                  Icon: Users,
                },
                {
                  value: true,
                  title: "Only people I choose",
                  body: "Pick teammates below",
                  Icon: Lock,
                },
              ].map((option) => (
                <label
                  key={String(option.value)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition-colors",
                    restricted === option.value
                      ? "bg-primary/[0.08] ring-2 ring-primary"
                      : "ring-border hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="cred-access"
                    className="sr-only"
                    checked={restricted === option.value}
                    onChange={() => setRestricted(option.value)}
                  />
                  <option.Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="block text-sm font-medium">{option.title}</span>
                    <span className="block text-xs text-muted-foreground">{option.body}</span>
                  </span>
                </label>
              ))}
            </div>

            {restricted ? (
              team.length > 0 ? (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {team.map((person) => {
                    const checked = accessIds.includes(person.userId);
                    return (
                      <li key={person.userId}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/50">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--primary)]"
                            checked={checked}
                            onChange={(e) =>
                              setAccessIds((prev) =>
                                e.target.checked
                                  ? [...prev, person.userId]
                                  : prev.filter((id) => id !== person.userId),
                              )
                            }
                          />
                          <AvatarMark name={person.name} src={person.avatarUrl} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{person.name}</span>
                            <span className="block truncate text-xs capitalize text-muted-foreground">
                              {person.role}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No one else is on this project yet. Add teammates from the Split tab.
                </p>
              )
            ) : null}

            <p className="text-xs text-muted-foreground">
              {always.length > 0
                ? `${always.map((p) => p.name).join(", ")} ${always.length === 1 ? "is an owner or admin and" : "are owners or admins and"} can always see credentials.`
                : "Owners and admins can always see credentials."}{" "}
              Whoever adds a credential keeps access to it.
            </p>
          </fieldset>
        ) : null}
      </form>
    </ActionSheet>
  );
}
