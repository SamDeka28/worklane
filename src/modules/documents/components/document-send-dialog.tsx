"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Ban, Eye, MailCheck, MailOpen, Send } from "lucide-react";
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
  revokeDocumentSendAction,
  sendDocumentEmailAction,
} from "@/modules/documents/actions";
import type { DocumentSend } from "@/modules/documents/sends";

export type SendRecipient = { name: string | null; email: string };

function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

function defaultMessage(input: {
  recipientName: string | null;
  kindLabel: string;
  title: string;
  senderName: string | null;
  orgName: string;
}) {
  const hello = firstName(input.recipientName) ? `Hi ${firstName(input.recipientName)},` : "Hi,";
  return [
    hello,
    "",
    `Please find our ${input.kindLabel.toLowerCase()} "${input.title}" at the link below. Happy to walk you through it or answer any questions.`,
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
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const initial = recipients[0] ?? null;
  const [to, setTo] = useState(initial?.email ?? "");
  const [recipientName, setRecipientName] = useState(initial?.name ?? "");
  const [message, setMessage] = useState(() =>
    defaultMessage({ recipientName: initial?.name ?? null, kindLabel, title, senderName, orgName }),
  );
  const [messageTouched, setMessageTouched] = useState(false);

  function pickRecipient(recipient: SendRecipient) {
    setTo(recipient.email);
    setRecipientName(recipient.name ?? "");
    if (!messageTouched) {
      setMessage(
        defaultMessage({ recipientName: recipient.name, kindLabel, title, senderName, orgName }),
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
          Send {kindLabel.toLowerCase()}
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
            defaultValue={`${kindLabel}: ${title}`}
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
                  {send.trackOpens ? (
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
