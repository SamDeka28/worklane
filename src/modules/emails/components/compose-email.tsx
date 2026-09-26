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
import type { EmailContact } from "@/modules/emails/types";

const EMPTY = { to: "", cc: "", subject: "", body: "" };

export function ComposeEmailButton({
  orgSlug,
  contacts,
  configured,
  replyTo,
}: {
  orgSlug: string;
  contacts: EmailContact[];
  /** SMTP is set up on this workspace. */
  configured: boolean;
  replyTo: string | null;
}) {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [sending, setSending] = useState(false);

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
      const result = await sendTrackedEmailAction(orgSlug, draft);
      if ("error" in result) {
        toast.error(result.error, { id: toastId });
        setOpen(true);
        return;
      }
      toast.success("Sent. You’ll see here when it’s opened.", { id: toastId });
      setDraft(EMPTY);
      setShowCc(false);
      router.replace(`/${orgSlug}/emails?email=${result.id}`, { scroll: false });
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
        onClick={() => setOpen(true)}
        disabled={!configured}
        title={configured ? undefined : "Email sending isn’t set up on this workspace yet"}
      >
        <PenLine />
        Compose
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New email</DialogTitle>
            <DialogDescription>
              Sent from your studio’s address with open tracking built in.
              {replyTo ? ` Replies go to ${replyTo}.` : ""}
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
            </div>
          </form>
          <DialogFooter className="items-center sm:justify-between">
            <p className="hidden text-xs text-muted-foreground sm:block">
              It won’t appear in your own mail app’s Sent folder.
            </p>
            <Button type="submit" form="compose-email-form" disabled={!canSend}>
              <Send />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
