"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  GitCompareArrows,
  History,
  MessageSquare,
  MessageSquarePlus,
  PenLine,
  Printer,
  Replace,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { DocumentReader } from "@/components/editor/document-reader";
import { cn } from "@/lib/utils";
import {
  postPortalFeedbackAction,
  signPortalDocumentAction,
} from "@/modules/documents/portal-actions";
import { diffTopLevelBlocks } from "@/modules/documents/diff";
import type {
  DocumentFeedback,
  SharedRevision,
  SharedSignature,
} from "@/modules/documents/sends";
import { SIGNATURE_FONT, SignatureBlocks } from "@/modules/documents/components/signature-blocks";


type ComposerMode = "comment" | "suggestion";

/** A studio reply is folded with addressed items once everything before it is resolved. */
function isAnsweredReply(reply: DocumentFeedback, all: DocumentFeedback[]) {
  const earlier = all.filter(
    (item) => item.authorType === "client" && item.kind !== "signed" && item.createdAt <= reply.createdAt,
  );
  return earlier.length > 0 && earlier.every((item) => item.resolvedAt);
}

const noopSubscribe = () => () => {};

/** Dates render in the reader's locale and timezone, so only format them in the browser. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function LocalDate({ value, dateOnly }: { value: string; dateOnly?: boolean }) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return (
    <>
      {dateOnly
        ? new Date(value).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : formatWhen(value)}
    </>
  );
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SharedDocumentView({
  token,
  title,
  orgName,
  recipientName,
  recipientEmail,
  sentAt,
  content,
  versionNumber,
  previousContent,
  previousVersionNumber,
  revisions,
  displayedSendId,
  isLatest,
  internalPreview,
  supersededAt,
  locked,
  signatures,
  clientSigned,
  accepted,
  feedback,
}: {
  token: string;
  title: string;
  orgName: string;
  recipientName: string | null;
  recipientEmail: string;
  sentAt: string;
  content: JSONContent;
  versionNumber: number | null;
  previousContent: JSONContent | null;
  previousVersionNumber: number | null;
  revisions: SharedRevision[];
  displayedSendId: string;
  isLatest: boolean;
  internalPreview: boolean;
  supersededAt: string | null;
  locked: boolean;
  signatures: SharedSignature[];
  clientSigned: boolean;
  accepted: boolean;
  feedback: DocumentFeedback[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<ComposerMode>("comment");
  const [quote, setQuote] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const latestRevisionNote = [...feedback].reverse().find((item) => item.kind === "revision");
  const addressedFeedback = feedback.filter(
    (item) =>
      Boolean(item.resolvedAt) ||
      ((item.kind === "reply" || item.kind === "revision") &&
        item !== latestRevisionNote &&
        isAnsweredReply(item, feedback)),
  );
  const openFeedback = feedback.filter((item) => !addressedFeedback.includes(item));

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [feedback.length]);

  const diff = useMemo(
    () => (previousContent ? diffTopLevelBlocks(previousContent, content) : null),
    [previousContent, content],
  );
  const changeCount = diff ? diff.changed.length + diff.removed : 0;
  const [showChanges, setShowChanges] = useState(false);
  const latest = revisions[revisions.length - 1];
  const canReview = !locked && !internalPreview && isLatest;
  const canSign = !clientSigned && !accepted && !internalPreview && isLatest && !supersededAt;
  const clientSignature = signatures.find((sig) => sig.party === "client");
  const studioSignature = signatures.find((sig) => sig.party === "studio");
  const openItems = feedback.filter(
    (item) => item.authorType === "client" && item.kind !== "signed" && !item.resolvedAt,
  ).length;

  useEffect(() => {
    if (!canReview) return;
    function onMouseUp() {
      const current = window.getSelection();
      const text = current?.toString().trim() ?? "";
      if (!current || !text || current.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const range = current.getRangeAt(0);
      if (!articleRef.current?.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSelection({ text: text.slice(0, 600), x: rect.left + rect.width / 2, y: rect.top });
    }
    function onScroll() {
      setSelection(null);
    }
    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("scroll", onScroll);
    };
  }, [canReview]);

  function startFromSelection(next: ComposerMode) {
    if (!selection) return;
    setQuote(selection.text);
    setMode(next);
    if (next === "suggestion") setSuggestion(selection.text);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function submitFeedback(kind: "comment" | "suggestion" | "changes_requested", text: string) {
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("body", text);
    if (quote && kind !== "changes_requested") formData.set("quote", quote);
    if (kind === "suggestion") formData.set("suggestion", suggestion);
    start(async () => {
      const result = await postPortalFeedbackAction(token, formData);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        kind === "changes_requested"
          ? `Sent to ${orgName}. They'll get back to you with a revision.`
          : "Thanks, your feedback was sent",
      );
      if (kind !== "changes_requested") {
        setBody("");
        setSuggestion("");
        setQuote(null);
        setMode("comment");
      }
      setChangesOpen(false);
      router.refresh();
    });
  }

  const hydrated = useHydrated();

  return (
    <div className="print:bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {orgName}
              {recipientName ? ` · for ${recipientName}` : ""}
            </p>
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
              {revisions.length > 1 ? (
                <nav aria-label="Revisions" className="flex shrink-0 items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
                  {revisions.map((revision, index) => {
                    const active =
                      revision.sendId === displayedSendId ||
                      (isLatest && index === revisions.length - 1);
                    const label = revision.versionNumber ? `v${revision.versionNumber}` : `#${index + 1}`;
                    return (
                      <Link
                        key={revision.sendId}
                        href={index === revisions.length - 1 ? pathname : `${pathname}?rev=${revision.sendId}`}
                        scroll={false}
                        title={hydrated ? `Sent ${formatWhen(revision.sentAt)}${index === revisions.length - 1 ? " · latest" : ""}` : undefined}
                        className={cn(
                          "rounded px-1.5 py-px text-[11px] font-medium transition-colors",
                          active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
                        )}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </nav>
              ) : null}
            </div>
          </div>
          <StatusPill
            locked={locked}
            clientSigned={Boolean(clientSignature)}
            studioSigned={Boolean(studioSignature)}
            openItems={openItems}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {canReview ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setChangesOpen(true)}
            >
              <RotateCcw className="size-4" />
              Request changes
            </Button>
          ) : null}
          {canReview || canSign ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={pending || !canSign}
                onClick={() => setSignOpen(true)}
                title={supersededAt ? "A newer revision was sent; sign that one instead" : undefined}
              >
                <PenLine className="size-4" />
                {studioSignature ? "Sign" : "Accept & sign"}
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] print:block print:p-0">
        <div className="min-w-0 space-y-4">
          {internalPreview ? (
            <Banner tone="amber">
              You&apos;re signed in to {orgName}, so this is a preview. Your visit isn&apos;t counted
              and review actions are turned off.
            </Banner>
          ) : null}
          {!isLatest ? (
            <Banner tone="amber" icon={History}>
              You&apos;re viewing an older revision
              {versionNumber ? ` (v${versionNumber})` : ""}.{" "}
              <Link href={pathname} scroll={false} className="font-medium underline underline-offset-2">
                Open the latest{latest?.versionNumber ? ` (v${latest.versionNumber})` : ""}
              </Link>{" "}
              to comment or sign.
            </Banner>
          ) : null}
          {diff ? (
            <div className="mx-auto flex max-w-[816px] flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900 print:hidden">
              <GitCompareArrows className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                {changeCount === 0
                  ? `No changes to the content since v${previousVersionNumber ?? "previous"}.`
                  : `Revised${versionNumber ? ` (v${versionNumber})` : ""}: ${diff.changed.length} section${diff.changed.length === 1 ? "" : "s"} changed${diff.removed ? `, ${diff.removed} removed` : ""} since v${previousVersionNumber ?? "previous"}.`}
              </span>
              {diff.changed.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowChanges((value) => !value)}
                  className="rounded-md bg-white/80 px-2 py-0.5 text-xs font-medium ring-1 ring-emerald-200 hover:bg-white"
                >
                  {showChanges ? "Hide highlights" : "Highlight changes"}
                </button>
              ) : null}
            </div>
          ) : null}
          {supersededAt && !locked && isLatest ? (
            <Banner tone="amber" icon={History}>
              A newer revision was shared with someone else on your team on{" "}
              <LocalDate value={supersededAt} dateOnly />
              , so signing happens on their copy. You can still comment here.
            </Banner>
          ) : null}
          {clientSignature && studioSignature ? (
            <Banner tone="green" icon={BadgeCheck}>
              Signed by {clientSignature.signerName} and countersigned by {studioSignature.signerName} for{" "}
              {orgName}. This copy is final.
            </Banner>
          ) : clientSignature ? (
            <Banner tone="green" icon={BadgeCheck}>
              Signed by {clientSignature.signerName} on <LocalDate value={clientSignature.signedAt} />.
              Waiting for {orgName} to countersign; you&apos;ll get an email when it&apos;s done.
            </Banner>
          ) : studioSignature ? (
            <Banner tone="green" icon={PenLine}>
              {studioSignature.signerName} signed this for {orgName} on{" "}
              <LocalDate value={studioSignature.signedAt} />. Add your signature to complete it.
            </Banner>
          ) : locked ? (
            <Banner tone="green" icon={BadgeCheck}>
              This document has been accepted and is final.
            </Banner>
          ) : null}

          <article
            ref={articleRef}
            className="mx-auto max-w-[816px] rounded-xl border border-slate-200 bg-white px-6 py-10 shadow-sm sm:px-14 sm:py-14 print:max-w-none print:border-0 print:p-0 print:shadow-none"
          >
            <DocumentReader
              content={content}
              highlight={showChanges && diff ? diff.changed : undefined}
            />
            <SignatureBlocks
              signatures={signatures}
              orgName={orgName}
              className="mt-12 border-t border-slate-200 pt-6"
            />
          </article>
          <p className="text-center text-xs text-slate-500 print:hidden">
            Shared with {recipientEmail} on <LocalDate value={sentAt} dateOnly />
            {canReview ? " · Select any text to comment on it or suggest an edit" : ""}
          </p>
        </div>

        <aside className="print:hidden lg:sticky lg:top-[76px] lg:self-start">
          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:max-h-[calc(100svh-96px)]">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <MessageSquare className="size-4 text-slate-500" />
              <h2 className="text-sm font-semibold">Comments</h2>
              <span className="ml-auto text-xs text-slate-500">
                {openFeedback.length > 0 ? `${openFeedback.length} open` : ""}
              </span>
            </div>
            <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              {addressedFeedback.length > 0 ? (
                <details className="group mb-3 rounded-lg border border-slate-100 bg-slate-50/70">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    Addressed ({addressedFeedback.length})
                    <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <ol className="space-y-2 px-2 pb-2">
                    {addressedFeedback.map((item) => (
                      <FeedbackItem key={item.id} item={item} orgName={orgName} />
                    ))}
                  </ol>
                </details>
              ) : null}
              {openFeedback.length === 0 ? (
                <p className="py-6 text-center text-xs leading-relaxed text-slate-500">
                  {feedback.length > 0
                    ? "Everything so far has been addressed."
                    : canReview
                      ? "Questions or changes? Leave a comment, or select text in the document to comment on a specific part."
                      : "No comments."}
                </p>
              ) : (
                <ol className="space-y-3">
                  {openFeedback.map((item) => (
                    <FeedbackItem key={item.id} item={item} orgName={orgName} />
                  ))}
                </ol>
              )}
            </div>
            {canReview ? (
              <form
                className="space-y-2 border-t border-slate-100 bg-slate-50/60 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitFeedback(mode, body);
                }}
              >
                <div className="flex gap-1 text-xs">
                  {(["comment", "suggestion"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setMode(value);
                        if (value === "suggestion" && quote && !suggestion) setSuggestion(quote);
                      }}
                      className={cn(
                        "rounded-full px-2.5 py-1 transition-colors",
                        mode === value
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-200/70",
                      )}
                    >
                      {value === "comment" ? "Comment" : "Suggest edit"}
                    </button>
                  ))}
                </div>
                {quote ? (
                  <div className="flex items-start gap-2 rounded-md border-l-2 border-amber-400 bg-amber-50 px-2 py-1.5 text-xs text-slate-700">
                    <span className="line-clamp-3 flex-1 italic">“{quote}”</span>
                    <button
                      type="button"
                      aria-label="Remove quote"
                      onClick={() => setQuote(null)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : mode === "suggestion" ? (
                  <p className="text-xs text-slate-500">
                    Select the text in the document you&apos;d like to change.
                  </p>
                ) : null}
                {mode === "suggestion" ? (
                  <Textarea
                    value={suggestion}
                    onChange={(event) => setSuggestion(event.target.value)}
                    rows={3}
                    placeholder="Replace with…"
                    className="bg-white text-sm"
                  />
                ) : null}
                <Textarea
                  ref={composerRef}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={mode === "suggestion" ? 2 : 3}
                  placeholder={mode === "suggestion" ? "Why? (optional)" : "Write a comment…"}
                  className="bg-white text-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={
                    pending ||
                    (mode === "comment" ? !body.trim() : !quote || !suggestion.trim())
                  }
                >
                  {pending ? "Sending…" : mode === "comment" ? "Send comment" : "Send suggestion"}
                </Button>
              </form>
            ) : null}
          </div>
        </aside>
      </div>

      {selection && canReview ? (
        <div
          className="fixed z-40 flex -translate-x-1/2 -translate-y-full gap-1 rounded-lg bg-slate-900 p-1 shadow-lg print:hidden"
          style={{ left: selection.x, top: selection.y - 8 }}
          onMouseUp={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => startFromSelection("comment")}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-white hover:bg-white/10"
          >
            <MessageSquarePlus className="size-3.5" />
            Comment
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => startFromSelection("suggestion")}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-white hover:bg-white/10"
          >
            <Replace className="size-3.5" />
            Suggest edit
          </button>
        </div>
      ) : null}

      <RequestChangesDialog
        open={changesOpen}
        onOpenChange={setChangesOpen}
        orgName={orgName}
        pending={pending}
        onSubmit={(text) => submitFeedback("changes_requested", text)}
      />
      <SignDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        token={token}
        title={title}
        orgName={orgName}
        recipientName={recipientName}
        recipientEmail={recipientEmail}
      />
    </div>
  );
}

function StatusPill({
  locked,
  clientSigned,
  studioSigned,
  openItems,
}: {
  locked: boolean;
  clientSigned: boolean;
  studioSigned: boolean;
  openItems: number;
}) {
  const label =
    clientSigned && studioSigned
      ? "Fully signed"
      : clientSigned
        ? "Awaiting countersignature"
        : studioSigned
          ? "Awaiting your signature"
          : locked
            ? "Accepted"
            : openItems > 0
              ? "In review"
              : "Awaiting signature";
  return (
    <span
      className={cn(
        "hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
        locked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
      )}
    >
      {label}
    </span>
  );
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "amber" | "green";
  icon?: typeof BadgeCheck;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mx-auto flex max-w-[816px] items-start gap-2 rounded-lg border px-3 py-2.5 text-sm print:hidden",
        tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900",
      )}
    >
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0" /> : null}
      <span>{children}</span>
    </p>
  );
}

const KIND_BADGE: Record<DocumentFeedback["kind"], { label: string; className: string }> = {
  comment: { label: "Comment", className: "bg-slate-100 text-slate-600" },
  suggestion: { label: "Suggested edit", className: "bg-sky-50 text-sky-700" },
  changes_requested: { label: "Changes requested", className: "bg-amber-50 text-amber-800" },
  reply: { label: "Reply", className: "bg-violet-50 text-violet-700" },
  signed: { label: "Signed", className: "bg-emerald-50 text-emerald-700" },
  revision: { label: "New revision", className: "bg-sky-50 text-sky-700" },
};

function FeedbackItem({ item, orgName }: { item: DocumentFeedback; orgName: string }) {
  const badge = KIND_BADGE[item.kind];
  const who =
    item.authorType === "studio"
      ? `${item.authorName ?? orgName}`
      : (item.authorName ?? item.authorEmail ?? "You");
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5 text-sm",
        item.authorType === "studio" ? "border-violet-100 bg-violet-50/40" : "border-slate-100",
        item.resolvedAt && "opacity-70",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-semibold text-slate-800">{who}</span>
        <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", badge.className)}>
          {badge.label}
        </span>
        {item.versionNumber ? <span className="text-slate-400">v{item.versionNumber}</span> : null}
        <span className="ml-auto text-slate-400">
          <LocalDate value={item.createdAt} />
        </span>
      </div>
      {item.quote ? (
        <p
          className={cn(
            "mb-1.5 border-l-2 border-amber-300 pl-2 text-xs italic text-slate-500",
            item.kind === "suggestion" && "line-through decoration-rose-400/70",
          )}
        >
          “{item.quote}”
        </p>
      ) : null}
      {item.kind === "suggestion" && item.suggestion ? (
        <p className="mb-1.5 border-l-2 border-emerald-400 pl-2 text-xs text-emerald-800">
          {item.suggestion}
        </p>
      ) : null}
      {item.body && item.kind !== "signed" ? (
        <p className="whitespace-pre-wrap text-slate-700">{item.body}</p>
      ) : item.kind === "revision" ? (
        <p className="text-slate-500">Published an updated version{item.versionNumber ? ` (v${item.versionNumber})` : ""}.</p>
      ) : null}
      {item.resolvedAt ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
          <CheckCircle2 className="size-3" />
          Addressed by {orgName}
        </p>
      ) : null}
    </li>
  );
}

function RequestChangesDialog({
  open,
  onOpenChange,
  orgName,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  pending: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-theme="light" className="bg-white text-slate-900 sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(text);
          }}
        >
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Tell {orgName} what should change. They&apos;ll send you a revised version to review
              and sign.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            required
            placeholder="e.g. Please move the second milestone to March and split the payment 50/50."
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !text.trim()}>
              {pending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SignDialog({
  open,
  onOpenChange,
  token,
  title,
  orgName,
  recipientName,
  recipientEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  title: string;
  orgName: string;
  recipientName: string | null;
  recipientEmail: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(recipientName ?? "");
  const [signature, setSignature] = useState(recipientName ?? "");
  const [signatureTouched, setSignatureTouched] = useState(false);
  const [consent, setConsent] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-theme="light" className="bg-white text-slate-900 sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData();
            formData.set("signer_name", name);
            formData.set("signature_text", signature);
            if (consent) formData.set("consent", "on");
            start(async () => {
              const result = await signPortalDocumentAction(token, formData);
              if ("error" in result && result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Signed. A confirmation is on its way to your inbox.");
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Accept and sign</DialogTitle>
            <DialogDescription>
              You&apos;re signing “{title}” from {orgName}. Once signed, this version is locked.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Full legal name</span>
              <Input
                value={name}
                required
                autoComplete="name"
                onChange={(event) => {
                  setName(event.target.value);
                  if (!signatureTouched) setSignature(event.target.value);
                }}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Email</span>
              <Input value={recipientEmail} readOnly disabled />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Signature</span>
              <Input
                value={signature}
                required
                onChange={(event) => {
                  setSignature(event.target.value);
                  setSignatureTouched(true);
                }}
                placeholder="Type your name to sign"
              />
            </label>
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
              <p
                className="min-h-12 truncate text-4xl leading-tight text-slate-900"
                style={{ fontFamily: SIGNATURE_FONT }}
              >
                {signature || " "}
              </p>
              <p className="mt-1 border-t border-slate-300 pt-1 text-[11px] text-slate-500">
                {name || "Your name"} · {new Date().toLocaleDateString()}
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 rounded border-input"
              />
              <span>
                I have read this document, I agree to its terms, and I adopt the typed name above as
                my electronic signature. I understand this is as binding as a handwritten signature.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !consent || !name.trim() || !signature.trim()}>
              <PenLine className="size-4" />
              {pending ? "Signing…" : "Sign document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
