"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useActionProgress as useTransition } from "@/components/studio/use-action-progress";
import {
  Check,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  History,
  KeyRound,
  Lock,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { AvatarMark } from "@/components/studio/chrome";
import { EmptyState } from "@/components/studio/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  deleteCredentialAction,
  listCredentialEventsAction,
  revealCredentialAction,
} from "@/modules/credentials/actions";
import { CredentialFormSheet } from "@/modules/credentials/components/credential-form";
import {
  CREDENTIAL_KIND_LABEL,
  type CredentialEvent,
  type CredentialKind,
  type CredentialPerson,
  type CredentialRecord,
  type CredentialSecret,
} from "@/modules/credentials/types";
import { relativeTime } from "@/modules/notifications/components/notification-item";

const AUTO_HIDE_SECONDS = 45;

const KIND_ICON: Record<CredentialKind, LucideIcon> = {
  login: Globe,
  api_key: KeyRound,
  database: Database,
  server: Server,
  email: Mail,
  other: Lock,
};

const KIND_TONE: Record<CredentialKind, string> = {
  login: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  api_key: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  database: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  server: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  email: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  other: "bg-muted text-muted-foreground",
};

const EVENT_LABEL: Record<CredentialEvent["action"], string> = {
  created: "added it",
  updated: "edited it",
  revealed: "revealed it",
  copied: "copied a secret",
  deleted: "deleted it",
  access_changed: "changed who can see it",
};

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 rounded-full px-3 text-xs font-medium",
        active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function linkFor(url: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(url) && !url.includes(":")) return `https://${url}`;
  return null;
}

async function writeClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function SecretRow({
  label,
  value,
  masked,
}: {
  label: string;
  value: string;
  masked: boolean;
}) {
  const [shown, setShown] = useState(!masked);
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-3 py-1.5">
      <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      <code
        className={cn(
          "min-w-0 truncate rounded-md bg-background px-2 py-1 font-mono text-[13px] ring-1 ring-border",
          !shown && "tracking-[0.2em] text-muted-foreground",
        )}
        title={shown ? value : undefined}
      >
        {shown ? value : "•".repeat(Math.min(value.length, 16))}
      </code>
      <span className="flex items-center">
        {masked ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={shown ? `Hide ${label}` : `Show ${label}`}
            onClick={() => setShown((s) => !s)}
          >
            {shown ? <EyeOff /> : <Eye />}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            if (await writeClipboard(value)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } else {
              toast.error("Couldn't copy");
            }
          }}
        >
          {copied ? <Check className="text-emerald-500" /> : <Copy />}
        </Button>
      </span>
    </div>
  );
}

function RevealedSecret({
  secret,
  kind,
  secondsLeft,
}: {
  secret: CredentialSecret;
  kind: CredentialKind;
  secondsLeft: number;
}) {
  const empty =
    !secret.username && !secret.password && secret.fields.length === 0 && !secret.notes;
  return (
    <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 ring-1 ring-border/60">
      {empty ? (
        <p className="py-1.5 text-sm text-muted-foreground">No secret details saved yet.</p>
      ) : (
        <div className="divide-y divide-border/50">
          <SecretRow
            label={kind === "api_key" ? "Key ID" : "Username"}
            value={secret.username}
            masked={false}
          />
          <SecretRow
            label={kind === "api_key" ? "Secret key" : "Password"}
            value={secret.password}
            masked
          />
          {secret.fields.map((field, index) => (
            <SecretRow
              key={index}
              label={field.label || "Field"}
              value={field.value}
              masked={field.secret}
            />
          ))}
          {secret.notes ? (
            <div className="py-2">
              <p className="text-xs font-medium text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{secret.notes}</p>
            </div>
          ) : null}
        </div>
      )}
      <p className="pt-1.5 text-right text-[11px] text-muted-foreground">
        Hides in {secondsLeft}s
      </p>
    </div>
  );
}

function CredentialCard({
  orgSlug,
  credential,
  peopleById,
  onEdit,
  onHistory,
}: {
  orgSlug: string;
  credential: CredentialRecord;
  peopleById: Map<string, CredentialPerson>;
  onEdit: () => void;
  onHistory: () => void;
}) {
  const router = useRouter();
  const [secret, setSecret] = useState<CredentialSecret | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pending, start] = useTransition();
  const Icon = KIND_ICON[credential.kind];
  const href = linkFor(credential.url);
  const updatedBy = credential.updatedBy ? peopleById.get(credential.updatedBy)?.name : null;
  const grantees = credential.accessUserIds
    .map((id) => peopleById.get(id))
    .filter((p): p is CredentialPerson => Boolean(p));

  useEffect(() => {
    if (!secret) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setSecret(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secret]);

  function reveal() {
    if (secret) {
      setSecret(null);
      return;
    }
    start(async () => {
      const result = await revealCredentialAction(orgSlug, credential.id, "reveal");
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSecret(result.secret);
      setSecondsLeft(AUTO_HIDE_SECONDS);
    });
  }

  function copyPassword() {
    start(async () => {
      const value = secret?.password;
      if (value) {
        if (await writeClipboard(value)) toast.success("Copied");
        return;
      }
      const result = await revealCredentialAction(orgSlug, credential.id, "copy");
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (!result.secret.password) {
        toast.error("No password saved");
        return;
      }
      if (await writeClipboard(result.secret.password)) toast.success("Password copied");
      else toast.error("Couldn't copy");
    });
  }

  function remove() {
    if (!window.confirm(`Delete "${credential.name}"? This can't be undone.`)) return;
    start(async () => {
      const result = await deleteCredentialAction(orgSlug, credential.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Credential deleted");
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl bg-card p-3.5 shadow-sm ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            KIND_TONE[credential.kind],
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">{credential.name}</p>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {CREDENTIAL_KIND_LABEL[credential.kind]}
            </span>
          </div>
          {credential.url ? (
            href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">{credential.url}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : (
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {credential.url}
              </p>
            )
          ) : null}
          {credential.projectName || credential.projectId === null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {credential.projectName ?? "No project"}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {credential.restricted ? (
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3" />
                Restricted
                {grantees.length > 0 ? (
                  <span className="flex -space-x-1.5">
                    {grantees.slice(0, 4).map((p) => (
                      <AvatarMark
                        key={p.userId}
                        name={p.name}
                        src={p.avatarUrl}
                        size="sm"
                        className="size-5 text-[8px]"
                      />
                    ))}
                  </span>
                ) : (
                  <span>· only you & admins</span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {credential.projectId ? "Project team" : "Studio"}
              </span>
            )}
            <span>
              Updated {relativeTime(credential.updatedAt)}
              {updatedBy ? ` by ${updatedBy}` : ""}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Copy password"
            title="Copy password"
            disabled={pending}
            onClick={copyPassword}
          >
            <Copy />
          </Button>
          <Button
            type="button"
            variant={secret ? "secondary" : "outline"}
            size="sm"
            disabled={pending}
            onClick={reveal}
          >
            {secret ? <EyeOff /> : <Eye />}
            {secret ? "Hide" : "Reveal"}
          </Button>
          {credential.canEdit || credential.canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="More actions" />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {credential.canEdit ? (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                ) : null}
                {credential.canManage ? (
                  <DropdownMenuItem onClick={onHistory}>
                    <History /> Access history
                  </DropdownMenuItem>
                ) : null}
                {credential.canManage ? (
                  <DropdownMenuItem variant="destructive" onClick={remove}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      {secret ? (
        <RevealedSecret secret={secret} kind={credential.kind} secondsLeft={secondsLeft} />
      ) : null}
    </li>
  );
}

function HistorySheet({
  orgSlug,
  credential,
  onClose,
}: {
  orgSlug: string;
  credential: CredentialRecord;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<CredentialEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCredentialEventsAction(orgSlug, credential.id).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        toast.error(result.error);
        setEvents([]);
        return;
      }
      setEvents(result.events);
    });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, credential.id]);

  return (
    <ActionSheet
      title="Access history"
      description={`Who added, edited, revealed, or copied "${credential.name}".`}
      hideTrigger
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {events === null ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="lane-skeleton h-10 rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ol className="grid gap-1">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/50"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{event.actorName}</span>{" "}
                <span className="text-muted-foreground">{EVENT_LABEL[event.action]}</span>
              </span>
              <time
                dateTime={event.createdAt}
                title={new Date(event.createdAt).toLocaleString()}
                className="shrink-0 text-xs text-muted-foreground"
              >
                {relativeTime(event.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </ActionSheet>
  );
}

export function CredentialsVault({
  orgSlug,
  projectId,
  credentials,
  team,
  always,
  people,
  projects,
  teamsByProject,
  studioTeam,
  canCreate,
  configured,
}: {
  orgSlug: string;
  projectId: string | null;
  credentials: CredentialRecord[];
  team: CredentialPerson[];
  always: CredentialPerson[];
  people: CredentialPerson[];
  projects?: { id: string; name: string }[];
  teamsByProject?: Record<string, CredentialPerson[]>;
  studioTeam?: CredentialPerson[];
  canCreate: boolean;
  configured: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CredentialKind | "all">("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [formFor, setFormFor] = useState<CredentialRecord | "new" | null>(null);
  const [historyFor, setHistoryFor] = useState<CredentialRecord | null>(null);
  const peopleById = useMemo(() => new Map(people.map((p) => [p.userId, p])), [people]);
  const studioList = Boolean(projects);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return credentials.filter((credential) => {
      if (kind !== "all" && credential.kind !== kind) return false;
      if (studioList && projectFilter === "studio" && credential.projectId) return false;
      if (studioList && projectFilter !== "all" && projectFilter !== "studio" && credential.projectId !== projectFilter) {
        return false;
      }
      if (!q) return true;
      return (
        credential.name.toLowerCase().includes(q) ||
        (credential.url ?? "").toLowerCase().includes(q) ||
        (credential.projectName ?? "").toLowerCase().includes(q) ||
        CREDENTIAL_KIND_LABEL[credential.kind].toLowerCase().includes(q)
      );
    });
  }, [credentials, kind, projectFilter, query, studioList]);

  const newButton =
    canCreate && configured ? (
      <Button type="button" size="sm" onClick={() => setFormFor("new")}>
        <Plus /> Add credential
      </Button>
    ) : null;

  return (
    <div className="grid gap-4">
      {!configured ? (
        <p className="rounded-xl bg-status-hold px-3.5 py-2.5 text-sm text-status-hold-fg">
          The credential vault needs an encryption key on the server
          (<code className="font-mono">CREDENTIALS_ENCRYPTION_KEY</code>) before it can be used.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search credentials"
            className="pl-9"
            aria-label="Search credentials"
          />
        </div>
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          Encrypted · every reveal is logged
        </span>
        {studioList ? (
          <NativeSelect
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            aria-label="Filter by project"
            className="w-auto min-w-40"
          >
            <option value="all">All projects</option>
            <option value="studio">No project</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <div className="ml-auto">{newButton}</div>
      </div>
      {studioList ? (
        <div className="flex flex-wrap gap-1.5">
          <FilterButton active={kind === "all"} onClick={() => setKind("all")}>
            All types
          </FilterButton>
          {(Object.keys(CREDENTIAL_KIND_LABEL) as CredentialKind[]).map((value) => (
            <FilterButton key={value} active={kind === value} onClick={() => setKind(value)}>
              {CREDENTIAL_KIND_LABEL[value]}
            </FilterButton>
          ))}
        </div>
      ) : null}

      {credentials.length === 0 ? (
        <EmptyState icon={KeyRound}
          title="No credentials yet"
          body={
            studioList
              ? "Keep logins, API keys, and server access here. Leave the project blank for studio-wide credentials, or attach one when it belongs to a project."
              : "Keep logins, API keys, and server access for this project in one place instead of spreadsheets and chats. Everything is encrypted, and you choose who can see each one."
          }
          action={newButton}
        />
      ) : filtered.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Nothing matches those filters.</p>
      ) : (
        <ul className="grid gap-2.5 xl:grid-cols-2">
          {filtered.map((credential) => (
            <CredentialCard
              key={credential.id}
              orgSlug={orgSlug}
              credential={credential}
              peopleById={peopleById}
              onEdit={() => setFormFor(credential)}
              onHistory={() => setHistoryFor(credential)}
            />
          ))}
        </ul>
      )}

      {formFor ? (
        <CredentialFormSheet
          key={formFor === "new" ? "new" : formFor.id}
          orgSlug={orgSlug}
          projectId={projectId}
          projects={projects}
          teamsByProject={teamsByProject}
          studioTeam={studioTeam}
          credential={formFor === "new" ? undefined : formFor}
          team={team}
          always={always}
          open
          onOpenChange={(open) => {
            if (!open) setFormFor(null);
          }}
        />
      ) : null}

      {historyFor ? (
        <HistorySheet
          orgSlug={orgSlug}
          credential={historyFor}
          onClose={() => setHistoryFor(null)}
        />
      ) : null}
    </div>
  );
}
