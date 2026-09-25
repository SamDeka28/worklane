"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Ban, Eye, FileCheck2, Link2, MailCheck, MailOpen, Paperclip, Send, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/studio/field";
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
import { cn } from "@/lib/utils";
import {
  copyDocumentSendLinkAction,
  emailSignedCopyAction,
  publishDocumentRevisionAction,
  revokeDocumentSendAction,
  sendDocumentEmailAction,
} from "@/modules/documents/actions";
import type { DocumentSend } from "@/modules/documents/sends";

export type SendRecipient = { name: string | null; email: string };

function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

function kindNoun(kindLabel: string) {
  return kindLabel === kindLabel.toUpperCase() ? kindLabel : kindLabel.toLowerCase();
}

function defaultMessage(input: {
  recipientName: string | null;
  kindLabel: string;
  title: string;
  senderName: string | null;
  orgName: string;
  revision?: boolean;
}) {
  const hello = firstName(input.recipientName) ? `Hi ${firstName(input.recipientName)},` : "Hi,";
  return [
    hello,
    "",
    input.revision
      ? `Thanks for your feedback. We've updated the ${kindNoun(input.kindLabel)} "${input.title}" to address it. The changes are highlighted when you open the link below, and it's ready for your signature once you're happy.`
      : `Please find our ${kindNoun(input.kindLabel)} "${input.title}" at the link below. Happy to walk you through it or answer any questions.`,
    "",
    "Best regards,",
    input.senderName ? `${input.senderName}\n${input.orgName}` : input.orgName,
  ].join("\n");
}

export function DocumentSendDialog({
  open,
  onOpenChange,
  orgSlug,
  orgName,
  documentId,
  versionId,
  title,
  kindLabel,
  senderName,
  recipients,
  getContent,
  getSource,
  sentBefore = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  orgName: string;
  documentId: string;
  versionId: string;
  title: string;
  kindLabel: string;
  senderName: string | null;
  recipients: SendRecipient[];
  getContent: () => JSONContent;
  getSource: () => JSONContent;
  sentBefore?: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {open ? (
          <SendForm
            orgSlug={orgSlug}
            orgName={orgName}
            documentId={documentId}
            versionId={versionId}
            title={title}
            kindLabel={kindLabel}
            senderName={senderName}
            recipients={recipients}
            getContent={getContent}
            getSource={getSource}
            sentBefore={sentBefore}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SendForm({
  orgSlug,
  orgName,
  documentId,
  versionId,
  title,
  kindLabel,
  senderName,
  recipients,
  getContent,
  getSource,
  sentBefore,
  onDone,
}: {
  orgSlug: string;
  orgName: string;
  documentId: string;
  versionId: string;
  title: string;
  kindLabel: string;
  senderName: string | null;
  recipients: SendRecipient[];
  getContent: () => JSONContent;
  getSource: () => JSONContent;
  sentBefore: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const initial = recipients[0] ?? null;
  const [to, setTo] = useState(initial?.email ?? "");
  const [recipientName, setRecipientName] = useState(initial?.name ?? "");
  const isRevision = (email: string) => sentBefore.includes(email.trim().toLowerCase());
  const [message, setMessage] = useState(() =>
    defaultMessage({
      recipientName: initial?.name ?? null,
      kindLabel,
      title,
      senderName,
      orgName,
      revision: isRevision(initial?.email ?? ""),
    }),
  );
  const [subject, setSubject] = useState(() =>
    isRevision(initial?.email ?? "")
      ? `Revised ${kindNoun(kindLabel)}: ${title}`
      : `${kindLabel}: ${title}`,
  );
  const [messageTouched, setMessageTouched] = useState(false);

  function pickRecipient(recipient: SendRecipient) {
    setTo(recipient.email);
    setRecipientName(recipient.name ?? "");
    if (!messageTouched) {
      setMessage(
        defaultMessage({
          recipientName: recipient.name,
          kindLabel,
          title,
          senderName,
          orgName,
          revision: isRevision(recipient.email),
        }),
      );
    }
  }

  return (
    <form
      className="grid gap-4"
      action={(formData) => {
        formData.set("recipient_name", recipientName);
        formData.set("version_id", versionId);
        formData.set("content_doc", JSON.stringify(getContent()));
        formData.set("source_doc", JSON.stringify(getSource()));
        start(async () => {
          const result = await sendDocumentEmailAction(orgSlug, documentId, formData);
          if ("error" in result && result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(`Sent to ${to}`);
          onDone();
          router.refresh();
        });
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Send className="size-4 text-muted-foreground" />
          Send {kindNoun(kindLabel)}
        </DialogTitle>
        <DialogDescription>
          Emailed from {orgName} with a private link to a read-only copy of what you see now.
          Replies come straight to you.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        <Field label="To" htmlFor="send-to" required>
          <Input
            id="send-to"
            name="to"
            type="email"
            required
            autoComplete="off"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              const match = recipients.find((r) => r.email === event.target.value.trim());
              setRecipientName(match?.name ?? "");
            }}
            placeholder="client@company.com"
          />
        </Field>
        {recipients.length > 0 ? (
          <div className="-mt-1 flex flex-wrap gap-1.5">
            {recipients.map((recipient) => (
              <button
                key={recipient.email}
                type="button"
                onClick={() => pickRecipient(recipient)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  to === recipient.email
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {recipient.name ? `${recipient.name} · ` : ""}
                {recipient.email}
              </button>
            ))}
          </div>
        ) : null}
        <Field label="CC" htmlFor="send-cc" hint="Separate multiple addresses with commas">
          <Input id="send-cc" name="cc" autoComplete="off" placeholder="Optional" />
        </Field>
        <Field label="Subject" htmlFor="send-subject" required>
          <Input
            id="send-subject"
            name="subject"
            required
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </Field>
        <Field label="Message" htmlFor="send-message" required>
          <Textarea
            id="send-message"
            name="message"
            required
            rows={9}
            maxLength={5000}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setMessageTouched(true);
            }}
          />
        </Field>
        <label className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="track"
            defaultChecked
            className="mt-0.5 rounded border-input"
          />
          <span>
            <span className="font-medium text-foreground">Track opens</span>
            <br />
            Adds an invisible image so you can see when the email is opened. Views of the link
            are always counted.
          </span>
        </label>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <Send className="size-4" />
          {pending ? "Sending…" : "Send email"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function relative(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function DocumentSendHistory({
  orgSlug,
  sends,
  canWrite,
}: {
  orgSlug: string;
  sends: DocumentSend[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (sends.length === 0) return null;

  return (
    <ul className="mt-3 grid gap-2 border-t border-border/40 pt-3">
      {sends.map((send) => {
        const revoked = Boolean(send.revokedAt);
        return (
          <li key={send.id} className={cn("text-xs", revoked && "opacity-60")}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-medium text-foreground" title={send.recipientEmail}>
                {send.versionNumber ? (
                  <span className="mr-1 text-muted-foreground">v{send.versionNumber}</span>
                ) : null}
                {send.recipientName || send.recipientEmail}
              </span>
              <span className="shrink-0 text-muted-foreground" title={new Date(send.sentAt).toLocaleString()}>
                {relative(send.sentAt)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {revoked ? (
                <Chip icon={Ban} tone="muted">Link revoked</Chip>
              ) : (
                <>
                  {send.viewCount > 0 ? (
                    <Chip
                      icon={Eye}
                      tone="good"
                      title={send.lastViewedAt ? `Last viewed ${new Date(send.lastViewedAt).toLocaleString()}` : undefined}
                    >
                      Viewed{send.viewCount > 1 ? ` ${send.viewCount}×` : ""}
                    </Chip>
                  ) : null}
                  {send.delivery === "link" ? (
                    <Chip icon={Link2} tone="muted">Published to link</Chip>
                  ) : send.trackOpens ? (
                    send.openCount > 0 ? (
                      <Chip
                        icon={MailOpen}
                        tone="good"
                        title={send.lastOpenedAt ? `Last opened ${new Date(send.lastOpenedAt).toLocaleString()}` : undefined}
                      >
                        Opened{send.openCount > 1 ? ` ${send.openCount}×` : ""}
                      </Chip>
                    ) : send.viewCount === 0 ? (
                      <Chip icon={MailCheck} tone="muted">Not opened yet</Chip>
                    ) : null
                  ) : send.viewCount === 0 ? (
                    <Chip icon={MailCheck} tone="muted">Delivered</Chip>
                  ) : null}
                  {canWrite ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="ml-auto text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      onClick={() => {
                        start(async () => {
                          const result = await copyDocumentSendLinkAction(orgSlug, send.id);
                          if ("error" in result && result.error) {
                            toast.error(result.error);
                            return;
                          }
                          if ("url" in result && result.url) {
                            await navigator.clipboard.writeText(result.url);
                            toast.success("Client link copied");
                          }
                        });
                      }}
                    >
                      Copy link
                    </button>
                  ) : null}
                  {canWrite ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                      onClick={() => {
                        if (!window.confirm("Revoke this link? The recipient won't be able to open it anymore.")) return;
                        start(async () => {
                          const result = await revokeDocumentSendAction(orgSlug, send.id);
                          if ("error" in result && result.error) toast.error(result.error);
                          else {
                            toast.success("Link revoked");
                            router.refresh();
                          }
                        });
                      }}
                    >
                      Revoke
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Chip({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Eye;
  tone: "good" | "muted";
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        tone === "good"
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {children}
    </span>
  );
}

export function PublishRevisionDialog({
  open,
  onOpenChange,
  orgSlug,
  documentId,
  versionId,
  versionNumber,
  recipients,
  getContent,
  getSource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  documentId: string;
  versionId: string;
  versionNumber: number;
  recipients: SendRecipient[];
  getContent: () => JSONContent;
  getSource: () => JSONContent;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData();
            formData.set("version_id", versionId);
            formData.set("note", note);
            if (notify) formData.set("notify", "on");
            formData.set("content_doc", JSON.stringify(getContent()));
            formData.set("source_doc", JSON.stringify(getSource()));
            start(async () => {
              const result = await publishDocumentRevisionAction(orgSlug, documentId, formData);
              if ("error" in result && result.error) {
                toast.error(result.error);
                return;
              }
              if ("ok" in result) {
                const failures = result.failures ?? [];
                if (failures.length > 0) {
                  toast.warning(
                    `Published v${result.versionNumber}, but the email to ${failures.join(", ")} failed`,
                  );
                } else {
                  toast.success(
                    notify
                      ? `Published v${result.versionNumber} and emailed ${result.emailed} recipient${result.emailed === 1 ? "" : "s"}`
                      : `Published v${result.versionNumber}. The client's link now shows it`,
                  );
                }
              }
              setNote("");
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadCloud className="size-4 text-muted-foreground" />
              Publish v{versionNumber} to the client
            </DialogTitle>
            <DialogDescription>
              Their existing link switches to this version, with changes highlighted. Earlier
              versions stay available, and only this one can be signed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((recipient) => (
                <span
                  key={recipient.email}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {recipient.name ? `${recipient.name} · ` : ""}
                  {recipient.email}
                </span>
              ))}
            </div>
            <Field label="What changed?" htmlFor="publish-note" hint="Shown in the comment thread and the email">
              <Textarea
                id="publish-note"
                rows={4}
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Updated payment terms to net 30 and added a round of post-launch fixes, as discussed."
              />
            </Field>
            <label className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={notify}
                onChange={(event) => setNotify(event.target.checked)}
                className="mt-0.5 rounded border-input"
              />
              <span>
                <span className="font-medium text-foreground">Email them a short update</span>
                <br />
                Untick to update the link quietly, for example for small fixes.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              <UploadCloud className="size-4" />
              {pending ? "Publishing…" : `Publish v${versionNumber}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmailSignedCopyDialog({
  open,
  onOpenChange,
  orgSlug,
  versionId,
  title,
  defaultTo,
  fullySigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  versionId: string;
  title: string;
  defaultTo: string;
  fullySigned: boolean;
}) {
  const [pending, start] = useTransition();
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [message, setMessage] = useState("");
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
  const files = fullySigned
    ? [`${slug}-signed.pdf`, `${slug}-signature-certificate.pdf`]
    : [`${slug}-signed-by-client.pdf`];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData();
            formData.set("to", to);
            formData.set("cc", cc);
            formData.set("message", message);
            start(async () => {
              const result = await emailSignedCopyAction(orgSlug, versionId, formData);
              if ("error" in result && result.error) {
                toast.error(result.error);
                return;
              }
              toast.success(`Signed copy sent to ${to}`);
              setMessage("");
              onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-muted-foreground" />
              Email the signed copy
            </DialogTitle>
            <DialogDescription>
              {fullySigned
                ? "Sends the fully signed PDF and the signature certificate."
                : "Sends the PDF with the client's signature. It still needs your countersignature."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Field label="To" htmlFor="signed-copy-to">
              <Input
                id="signed-copy-to"
                type="email"
                required
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="client@company.com"
              />
            </Field>
            <Field label="CC" htmlFor="signed-copy-cc" hint="Optional, separate with commas">
              <Input
                id="signed-copy-cc"
                value={cc}
                onChange={(event) => setCc(event.target.value)}
                placeholder="legal@company.com"
              />
            </Field>
            <Field label="Message" htmlFor="signed-copy-message" hint="Optional">
              <Textarea
                id="signed-copy-message"
                rows={3}
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Here's the signed copy for your records."
              />
            </Field>
            <div className="grid gap-1 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              {files.map((file) => (
                <span key={file} className="flex items-center gap-1.5 truncate">
                  <Paperclip className="size-3 shrink-0" />
                  {file}
                </span>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !to.trim()}>
              <Send className="size-4" />
              {pending ? "Sending…" : "Send signed copy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
