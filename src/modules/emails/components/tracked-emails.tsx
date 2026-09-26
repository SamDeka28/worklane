"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Eye, Link2, MailPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { DenseCell, DenseListPanel, DenseRow } from "@/components/studio/index-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createTrackedEmailAction,
  deleteTrackedEmailAction,
  dismissTrackedEmailOpenAction,
  listTrackedEmailOpensAction,
  markTrackedEmailCopiedAction,
  updateTrackedEmailAction,
} from "@/modules/emails/actions";
import {
  pixelHtml,
  trackedEmailTitle,
  type TrackedEmail,
  type TrackedEmailOpen,
} from "@/modules/emails/types";
import { relativeTime } from "@/modules/notifications/components/notification-item";
import { MailAppSteps } from "./pixel-guide";

/**
 * Copies the pixel as rich HTML so it pastes as an image, not as a link. Must run
 * synchronously inside the click: browsers drop the HTML part of clipboard writes that
 * finish after the gesture, leaving only the plain-text link.
 */
function copyPixel(pixelUrl: string): boolean {
  const html = pixelHtml(pixelUrl);
  const onCopy = (event: ClipboardEvent) => {
    event.clipboardData?.setData("text/html", html);
    event.clipboardData?.setData("text/plain", pixelUrl);
    event.preventDefault();
  };
  document.addEventListener("copy", onCopy);
  try {
    if (document.execCommand("copy")) return true;
  } catch {
    // Fall through to the async clipboard API.
  } finally {
    document.removeEventListener("copy", onCopy);
  }
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
  navigator.clipboard
    .write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([pixelUrl], { type: "text/plain" }),
      }),
    ])
    .catch(() => toast.error("Your browser blocked the clipboard. Click Copy pixel to try again."));
  return true;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A contenteditable box that reports whether a paste arrived as an image or as a link. */
function PasteCheck() {
  const [result, setResult] = useState<"image" | "link" | null>(null);
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Paste here to check the pixel"
      onPaste={(event) => {
        event.preventDefault();
        const html = event.clipboardData.getData("text/html");
        setResult(/<img[^>]+mail-open|<img[^>]+\/portal\/t\//i.test(html) ? "image" : "link");
      }}
      onKeyDown={(event) => {
        if (!(event.metaKey || event.ctrlKey)) event.preventDefault();
      }}
      className={cn(
        "rounded-lg border border-dashed px-3 py-2 text-xs outline-none focus:border-primary",
        result === "image"
          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
          : result === "link"
            ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
            : "border-border text-muted-foreground",
      )}
    >
      {result === "image"
        ? "✓ Looks good: it pastes as an invisible image."
        : result === "link"
          ? "Only a link was copied. Click Copy again, then paste with ⌘V (not ⌘⇧V)."
          : "Paste here to check it (optional)"}
    </div>
  );
}

/** Loads the pixel as its sender, so opens from this network aren't counted. */
function ClaimBeacon({ url }: { url: string | null }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={1} height={1} aria-hidden className="pointer-events-none absolute size-px opacity-0" />;
}

export function TrackEmailButton({
  orgSlug,
  pixelBase,
  label = "Track an email",
  variant = "default",
}: {
  orgSlug: string;
  /** Pixel URL without the token, so the pixel can be copied before the server saves it. */
  pixelBase: string;
  label?: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [recipient, setRecipient] = useState("");
  const [created, setCreated] = useState<TrackedEmail | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  function reset() {
    setSubject("");
    setRecipient("");
    setCreated(null);
    setCopied(false);
  }

  async function create() {
    if (pending) return;
    setPending(true);
    const token = randomToken();
    const didCopy = copyPixel(`${pixelBase}${encodeURIComponent(token)}`);
    try {
      const result = await createTrackedEmailAction(orgSlug, { subject, recipient, token });
      if ("error" in result) {
        toast.error(`${result.error} Don’t use the copied pixel.`);
        return;
      }
      setCreated(result.email);
      setCopied(didCopy && result.email.pixelUrl.endsWith(encodeURIComponent(token)));
      router.refresh();
    } catch {
      toast.error("Couldn’t create the pixel. Don’t use the copied one; try again.");
    } finally {
      setPending(false);
    }
  }

  async function copyAgain(kind: "pixel" | "link") {
    if (!created) return;
    void markTrackedEmailCopiedAction(orgSlug, created.id);
    try {
      if (kind === "pixel") {
        if (!copyPixel(created.pixelUrl)) throw new Error("blocked");
      } else {
        await navigator.clipboard.writeText(created.pixelUrl);
      }
      setCopied(true);
      toast.success(kind === "pixel" ? "Pixel copied" : "Link copied");
    } catch {
      toast.error("Your browser blocked the clipboard");
    }
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        <MailPlus />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{created ? "Pixel ready" : "Track an email"}</DialogTitle>
            <DialogDescription>
              {created
                ? trackedEmailTitle(created)
                : "Get an invisible pixel for an email you send from your own mail app. Both fields are optional."}
            </DialogDescription>
          </DialogHeader>

          {created ? (
            <div className="grid gap-3">
              <ClaimBeacon url={created.claimUrl} />
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{copied ? "Pixel copied" : "Pixel created"}</p>
                  <p className="text-xs text-muted-foreground">
                    Paste it anywhere in your email with ⌘V. It’s invisible.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => copyAgain("pixel")}>
                  <Copy />
                  {copied ? "Copy again" : "Copy"}
                </Button>
              </div>
              <PasteCheck />
              <details className="group rounded-xl text-sm">
                <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
                  <span className="group-open:hidden">How to paste in Gmail, Outlook, or Apple Mail →</span>
                  <span className="hidden group-open:inline">Hide steps</span>
                </summary>
                <div className="mt-3 grid gap-3">
                  <MailAppSteps compact />
                  <button
                    type="button"
                    onClick={() => copyAgain("link")}
                    className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Link2 className="size-3.5" />
                    Copy link only (for Outlook classic)
                  </button>
                </div>
              </details>
            </div>
          ) : (
            <form
              id="track-email-form"
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="track-email-subject">Subject</Label>
                <Input
                  id="track-email-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={200}
                  placeholder="So you recognise it later"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="track-email-recipient">Recipient</Label>
                <Input
                  id="track-email-recipient"
                  type="email"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  maxLength={320}
                  placeholder="name@company.com"
                />
                <p className="text-xs text-muted-foreground">
                  Matching a lead’s email links the opens to that lead.
                </p>
              </div>
            </form>
          )}

          <DialogFooter>
            {created ? (
              <>
                <Button type="button" variant="ghost" onClick={reset}>
                  Track another
                </Button>
                <Button type="button" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </>
            ) : (
              <Button type="submit" form="track-email-form" disabled={pending}>
                <Copy />
                {pending ? "Creating…" : "Create and copy pixel"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OpenState({ email, now }: { email: TrackedEmail; now: number }) {
  if (email.openCount === 0 || !email.lastOpenedAt) {
    return <span className="text-muted-foreground">Not opened yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
      <Eye className="size-3 shrink-0" />
      <span className="truncate">
        Opened{email.openCount > 1 ? ` ${email.openCount}×` : ""} · {relativeTime(email.lastOpenedAt, now)}
      </span>
    </span>
  );
}

export function TrackedEmailList({
  orgSlug,
  emails,
  showCreator,
  now,
}: {
  orgSlug: string;
  emails: TrackedEmail[];
  showCreator: boolean;
  now: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const linked = searchParams.get("email");
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked ?? linked;
  const selected = emails.find((email) => email.id === selectedId) ?? null;
  const beacons = emails.filter((email) => email.claimUrl).slice(0, 20);

  function close() {
    setPicked(null);
    if (linked) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("email");
      const rest = params.toString();
      router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
    }
  }

  return (
    <>
      <div aria-hidden className="relative">
        {beacons.map((email) => (
          <ClaimBeacon key={email.id} url={email.claimUrl} />
        ))}
      </div>
      <DenseListPanel
        columnsClassName="sm:gap-6"
        columns={
          <>
            <span className="min-w-0 flex-1">Email</span>
            <span className="hidden w-48 md:block">Opens</span>
            {showCreator ? <span className="hidden w-32 lg:block">Sent by</span> : null}
            <span className="hidden w-24 text-right sm:block">Date</span>
          </>
        }
        footer="Opens are counted when the recipient’s mail app loads images. Apple Mail can load them automatically, and some people block images, so treat opens as a signal, not proof."
      >
        {emails.map((email) => (
          <DenseRow key={email.id} className="sm:gap-6">
            <DenseCell className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setPicked(email.id)}
                className="block w-full min-w-0 text-left"
              >
                <p className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{trackedEmailTitle(email)}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase",
                      email.sentAt
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {email.sentAt ? "Sent" : "Pixel"}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[email.recipient, email.leadName ? `Lead: ${email.leadName}` : null]
                    .filter(Boolean)
                    .join(" · ") || "No recipient added"}
                </p>
                <p className="mt-1 text-[11px] md:hidden">
                  <OpenState email={email} now={now} />
                </p>
              </button>
            </DenseCell>
            <DenseCell width="hidden w-48 md:block" className="text-xs">
              <OpenState email={email} now={now} />
            </DenseCell>
            {showCreator ? (
              <DenseCell width="hidden w-32 lg:block" className="truncate text-xs text-muted-foreground">
                {email.mine ? "You" : (email.creatorName ?? "Teammate")}
              </DenseCell>
            ) : null}
            <DenseCell align="right" width="hidden w-24 sm:block" className="text-xs text-muted-foreground">
              {relativeTime(email.sentAt ?? email.createdAt, now)}
            </DenseCell>
          </DenseRow>
        ))}
      </DenseListPanel>
      {selected ? (
        <TrackedEmailSheet
          key={selected.id}
          orgSlug={orgSlug}
          email={selected}
          now={now}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function TrackedEmailSheet({
  orgSlug,
  email,
  now,
  onClose,
}: {
  orgSlug: string;
  email: TrackedEmail;
  now: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dismissing, startDismiss] = useTransition();
  const [subject, setSubject] = useState(email.subject ?? "");
  const [recipient, setRecipient] = useState(email.recipient ?? "");
  const [opens, setOpens] = useState<TrackedEmailOpen[] | null>(null);
  const dirty = subject !== (email.subject ?? "") || recipient !== (email.recipient ?? "");

  useEffect(() => {
    let cancelled = false;
    listTrackedEmailOpensAction(orgSlug, email.id)
      .then((rows) => {
        if (!cancelled) setOpens(rows);
      })
      .catch(() => {
        if (!cancelled) setOpens([]);
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, email.id, email.openCount]);

  function save() {
    start(async () => {
      const result = await updateTrackedEmailAction(orgSlug, email.id, { subject, recipient });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const result = await deleteTrackedEmailAction(orgSlug, email.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stopped tracking this email");
      onClose();
      router.refresh();
    });
  }

  function dismissOpen(openId: number) {
    startDismiss(async () => {
      const result = await dismissTrackedEmailOpenAction(orgSlug, email.id, openId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setOpens((current) => current?.filter((item) => item.id !== openId) ?? current);
      toast.success("Removed. Opens like this one won’t count again.");
      router.refresh();
    });
  }

  async function copy(kind: "pixel" | "link") {
    void markTrackedEmailCopiedAction(orgSlug, email.id);
    try {
      if (kind === "pixel") {
        if (!copyPixel(email.pixelUrl)) throw new Error("blocked");
      } else {
        await navigator.clipboard.writeText(email.pixelUrl);
      }
      toast.success(kind === "pixel" ? "Pixel copied" : "Link copied");
    } catch {
      toast.error("Your browser blocked the clipboard");
    }
  }

  return (
    <ActionSheet
      title={trackedEmailTitle(email)}
      description={email.recipient ?? "No recipient added"}
      hideTrigger
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      footer={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={remove}
            disabled={pending}
          >
            <Trash2 />
            Delete
          </Button>
          <span className="flex-1" />
          {email.mine && !email.sentAt ? (
            <Button type="button" onClick={save} disabled={pending || !dirty}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-6">
        <ClaimBeacon url={email.claimUrl} />
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Opens", value: String(email.openCount) },
            {
              label: "First opened",
              value: email.firstOpenedAt ? relativeTime(email.firstOpenedAt, now) : "—",
            },
            {
              label: "Last opened",
              value: email.lastOpenedAt ? relativeTime(email.lastOpenedAt, now) : "—",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-muted/50 p-3">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        {email.leadId ? (
          <Link
            href={`/${orgSlug}/crm?lead=${email.leadId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Open lead{email.leadName ? `: ${email.leadName}` : ""}
          </Link>
        ) : null}

        {email.sentAt ? (
          <section className="grid gap-3">
            <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Sent from Worklane
            </h3>
            <dl className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">To</dt>
              <dd className="min-w-0 truncate">{email.recipient}</dd>
              {email.cc.length > 0 ? (
                <>
                  <dt className="text-muted-foreground">CC</dt>
                  <dd className="min-w-0 truncate">{email.cc.join(", ")}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Sent</dt>
              <dd title={new Date(email.sentAt).toLocaleString()}>
                {email.mine ? "By you" : `By ${email.creatorName ?? "a teammate"}`} ·{" "}
                {relativeTime(email.sentAt, now)}
              </dd>
            </dl>
            {email.body ? (
              <div className="max-h-80 overflow-y-auto rounded-xl bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {email.body}
              </div>
            ) : null}
          </section>
        ) : email.mine ? (
          <section className="grid gap-3">
            <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Details
            </h3>
            <div className="grid gap-1.5">
              <Label htmlFor={`subject-${email.id}`}>Subject</Label>
              <Input
                id={`subject-${email.id}`}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={200}
                placeholder="So you recognise it later"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`recipient-${email.id}`}>Recipient</Label>
              <Input
                id={`recipient-${email.id}`}
                type="email"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                maxLength={320}
                placeholder="name@company.com"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => copy("pixel")}>
                <Copy />
                Copy pixel again
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => copy("link")}>
                <Link2 />
                Copy link only
              </Button>
            </div>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tracked by {email.creatorName ?? "a teammate"}.
          </p>
        )}

        <section className="grid gap-3">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Opens
          </h3>
          {opens == null ? (
            <div className="grid gap-2" aria-busy>
              {[0, 1].map((index) => (
                <span key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : opens.length === 0 ? (
            <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
              Not opened yet. You’ll get a notification the first time it’s read.
            </p>
          ) : (
            <ul className="grid gap-1">
              {opens.map((item, index) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
                    index === 0 ? "bg-emerald-500/10" : "bg-muted/40",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Eye className="size-3.5 text-muted-foreground" />
                    {item.client ?? "Unknown app"}
                  </span>
                  <span className="inline-flex items-center gap-3">
                    {email.mine ? (
                      <button
                        type="button"
                        onClick={() => dismissOpen(item.id)}
                        disabled={dismissing}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        This was me
                      </button>
                    ) : null}
                    <span
                      className="text-xs text-muted-foreground"
                      title={new Date(item.at).toLocaleString()}
                    >
                      {relativeTime(item.at, now)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ActionSheet>
  );
}
