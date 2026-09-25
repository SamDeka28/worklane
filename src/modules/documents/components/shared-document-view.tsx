"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import {
  BadgeCheck,
  CheckCircle2,
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
import type { DocumentFeedback, SharedSignature } from "@/modules/documents/sends";

const SIGNATURE_FONT =
  '"Snell Roundhand", "Apple Chancery", "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive';

type ComposerMode = "comment" | "suggestion";

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
  internalPreview,
  supersededAt,
  locked,
  signature,
  feedback,
}: {
  token: string;
  title: string;
  orgName: string;
  recipientName: string | null;
  recipientEmail: string;
  sentAt: string;
  content: JSONContent;
  internalPreview: boolean;
  supersededAt: string | null;
  locked: boolean;
  signature: SharedSignature | null;
  feedback: DocumentFeedback[];
}) {
  const router = useRouter();
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

  const canReview = !locked && !internalPreview;
  const canSign = canReview && !supersededAt;
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

  const sentOn = new Date(sentAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="print:bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              {orgName}
              {recipientName ? ` · for ${recipientName}` : ""}
            </p>
            <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
          </div>
          <StatusPill locked={locked} signature={signature} openItems={openItems} />
          <Button type="button" variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {canReview ? (
            <>
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
              <Button
                type="button"
                size="sm"
                disabled={pending || !canSign}
                onClick={() => setSignOpen(true)}
                title={supersededAt ? "A newer revision was sent; sign that one instead" : undefined}
              >
                <PenLine className="size-4" />
                Accept &amp; sign
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
          {supersededAt && !locked ? (
            <Banner tone="amber" icon={History}>
              A newer revision was sent on{" "}
              {new Date(supersededAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              . Please open the latest email to review and sign it. You can still comment here.
            </Banner>
          ) : null}
          {locked && signature ? (
            <Banner tone="green" icon={BadgeCheck}>
              Signed by {signature.signerName} on {formatWhen(signature.signedAt)}. This copy is
              final.
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
            <DocumentReader content={content} />
            {signature ? <SignatureBlock signature={signature} /> : null}
          </article>
          <p className="text-center text-xs text-slate-500 print:hidden">
            Shared with {recipientEmail} on {sentOn}
            {canReview ? " · Select any text to comment on it or suggest an edit" : ""}
          </p>
        </div>

        <aside className="print:hidden lg:sticky lg:top-[76px] lg:max-h-[calc(100svh-96px)] lg:self-start">
          <div className="flex max-h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <MessageSquare className="size-4 text-slate-500" />
              <h2 className="text-sm font-semibold">Comments</h2>
              <span className="ml-auto text-xs text-slate-500">{feedback.length || ""}</span>
            </div>
            <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {feedback.length === 0 ? (
                <li className="py-6 text-center text-xs leading-relaxed text-slate-500">
                  {canReview
                    ? "Questions or changes? Leave a comment, or select text in the document to comment on a specific part."
                    : "No comments."}
                </li>
              ) : (
                feedback.map((item) => <FeedbackItem key={item.id} item={item} orgName={orgName} />)
              )}
            </ol>
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
  signature,
  openItems,
}: {
  locked: boolean;
  signature: SharedSignature | null;
  openItems: number;
}) {
  const label = signature ? "Signed" : locked ? "Accepted" : openItems > 0 ? "In review" : "Awaiting signature";
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
        <span className="ml-auto text-slate-400">{formatWhen(item.createdAt)}</span>
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

function SignatureBlock({ signature }: { signature: SharedSignature }) {
  return (
    <section className="mt-12 border-t border-slate-200 pt-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        Signed electronically
      </p>
      <p className="mt-3 text-4xl leading-tight text-slate-900" style={{ fontFamily: SIGNATURE_FONT }}>
        {signature.signatureText ?? signature.signerName}
      </p>
      <div className="mt-2 grid gap-x-8 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
        <p>
          <span className="text-slate-400">Name</span> {signature.signerName}
        </p>
        <p>
          <span className="text-slate-400">Email</span> {signature.signerEmail}
        </p>
        <p>
          <span className="text-slate-400">Signed</span> {new Date(signature.signedAt).toUTCString()}
        </p>
        {signature.contentHash ? (
          <p className="truncate" title={signature.contentHash}>
            <span className="text-slate-400">Fingerprint</span> {signature.contentHash.slice(0, 24)}…
          </p>
        ) : null}
      </div>
    </section>
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
