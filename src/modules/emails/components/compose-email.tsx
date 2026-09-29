"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Send } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendTrackedEmailAction } from "@/modules/emails/actions";
import type { EmailAttachmentPayload, EmailContact } from "@/modules/emails/types";
import { ComposerSignature } from "@/modules/email-signatures/components/signature-forms";
import type { RenderedSignature } from "@/modules/email-signatures/types";
import { EmailAttachments } from "@/modules/emails/components/email-attachments";

const EMPTY = { to: "", cc: "", subject: "", body: "" };

export function ComposeEmailButton({
  orgSlug,
  contacts,
  configured,
  replyTo,
  fromAddress,
  signature,
  triggerLabel = "Compose",
  title = "New email",
  description,
  initialDraft,
  sendAction,
  successMessage,
  sendLabel,
  triggerVariant = "default",
  disabled = false,
}: {
  orgSlug: string;
  contacts: EmailContact[];
  /** SMTP is set up on this workspace. */
  configured: boolean;
  replyTo: string | null;
  fromAddress: string | null;
  /** Filled-in signature added below the message, or null for none. */
  signature: RenderedSignature | null;
  triggerLabel?: string;
  title?: string;
  description?: string;
  initialDraft?: Partial<typeof EMPTY>;
  sendAction?: (input: typeof EMPTY & { includeSignature: boolean; attachments: EmailAttachmentPayload[] }) => Promise<{ ok: true; id?: string } | { error: string }>;
  successMessage?: string;
  sendLabel?: string;
  triggerVariant?: "default" | "outline";
  disabled?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [withSignature, setWithSignature] = useState(true);
  const [attachments, setAttachments] = useState<EmailAttachmentPayload[]>([]);

  const contact = contacts.find((item) => item.email === draft.to.trim().toLowerCase());
  const canSend =
    !sending && draft.to.trim() !== "" && draft.subject.trim() !== "" && draft.body.trim() !== "";

  function update(field: keyof typeof EMPTY, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function send() {
    if (!canSend) return;
    setSending(true);
    setOpen(false);
    const toastId = toast.loading(`Sending to ${draft.to.trim()}…`);
    try {
      const payload = {
        ...draft,
        includeSignature: withSignature && Boolean(signature),
        attachments,
      };
      const result = sendAction ? await sendAction(payload) : await sendTrackedEmailAction(orgSlug, payload);
      if ("error" in result) {
        toast.error(result.error, { id: toastId });
        setOpen(true);
        return;
      }
      toast.success(successMessage ?? "Sent. You’ll see here when it’s opened.", { id: toastId });
      setDraft(EMPTY);
      setAttachments([]);
      setShowCc(false);
      if (result.id) router.replace(`/${orgSlug}/emails?email=${result.id}`, { scroll: false });
    } catch {
      toast.error("Couldn’t send the email. Try again.", { id: toastId });
      setOpen(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        onClick={() => { setDraft({ ...EMPTY, ...initialDraft }); setAttachments([]); setOpen(true); }}
        disabled={!configured || disabled}
        title={
          configured
            ? undefined
            : "Email sending isn’t set up. An owner or admin can connect the studio’s mailbox in Settings."
        }
      >
        <PenLine />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description ?? <>Sent from {fromAddress ?? "your studio’s address"} with open tracking built in.{replyTo ? ` Replies go to ${replyTo}.` : ""}</>}
            </DialogDescription>
          </DialogHeader>
          <form
            id="compose-email-form"
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="compose-to">To</Label>
                {showCc ? null : (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Add CC
                  </button>
                )}
              </div>
              <Input
                id="compose-to"
                type="email"
                list={listId}
                value={draft.to}
                onChange={(event) => update("to", event.target.value)}
                placeholder="name@company.com"
                autoComplete="off"
                maxLength={320}
                autoFocus
              />
              <datalist id={listId}>
                {contacts.map((item) => (
                  <option key={item.email} value={item.email}>
                    {item.name} · {item.kind === "lead" ? "Lead" : "Client contact"}
                  </option>
                ))}
              </datalist>
              {contact ? (
                <p className="text-xs text-muted-foreground">
                  {contact.name} · {contact.kind === "lead" ? "Logged on the lead’s timeline too" : "Client contact"}
                </p>
              ) : null}
            </div>
            {showCc ? (
              <div className="grid gap-1.5">
                <Label htmlFor="compose-cc">CC</Label>
                <Input
                  id="compose-cc"
                  value={draft.cc}
                  onChange={(event) => update("cc", event.target.value)}
                  placeholder="Separate addresses with commas"
                  autoComplete="off"
                />
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                value={draft.subject}
                onChange={(event) => update("subject", event.target.value)}
                maxLength={200}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="compose-body" className="sr-only">
                Message
              </Label>
              <Textarea
                id="compose-body"
                value={draft.body}
                onChange={(event) => update("body", event.target.value)}
                placeholder="Write your email…"
                className="min-h-56 resize-y"
                maxLength={20_000}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              {signature ? (
                <div className="rounded-xl ring-1 ring-foreground/10">
                  <ComposerSignature
                    signature={signature}
                    include={withSignature}
                    onIncludeChange={setWithSignature}
                    editHref={`/${orgSlug}/profile#signature`}
                  />
                </div>
              ) : null}
            </div>
            <EmailAttachments value={attachments} onChange={setAttachments} disabled={sending} />
          </form>
          <DialogFooter className="items-center sm:justify-between">
            <p className="hidden text-xs text-muted-foreground sm:block">
              It won’t appear in your own mail app’s Sent folder.
            </p>
            <Button type="submit" form="compose-email-form" disabled={!canSend}>
              <Send />
              {sendLabel ?? "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
