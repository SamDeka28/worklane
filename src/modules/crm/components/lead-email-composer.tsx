"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CornerUpLeft, Mail, Sparkles } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { sendLeadEmailAction } from "@/modules/crm/email-actions";
import type { LeadEmailHistory, LeadEmailSender } from "@/modules/crm/queries";
import {
  addDays,
  dueLabel,
  fillTemplate,
  leadMergeValues,
  replySubject,
  suggestTemplate,
  unfilledFields,
} from "@/modules/crm/presentation";
import type { CrmSettings, LeadEmailTemplate } from "@/modules/crm/settings";
import {
  isStale,
  openPipelineStages,
  type LeadRecord,
  type LeadStageRecord,
} from "@/modules/crm/types";

const FOLLOW_UP_PRESETS = [
  { label: "2 days", days: 2 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
];

const NO_HISTORY: LeadEmailHistory = { proposalSent: false, previous: [] };
const historyCache = new Map<string, LeadEmailHistory>();
const historyRequests = new Map<string, Promise<LeadEmailHistory>>();

const historyKey = (orgSlug: string, leadId: string) => `${orgSlug}/${leadId}`;

/** `fresh` skips the cached result but still joins a request already in flight. */
function loadEmailHistory(orgSlug: string, leadId: string, fresh = false) {
  const key = historyKey(orgSlug, leadId);
  const cached = historyCache.get(key);
  if (cached && !fresh) return Promise.resolve(cached);
  const inFlight = historyRequests.get(key);
  if (inFlight) return inFlight;
  const request = fetch(`/${orgSlug}/crm/leads/${leadId}/emails`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Email history failed (${response.status})`);
      return (await response.json()) as LeadEmailHistory;
    })
    .then((history) => {
      historyCache.set(key, history);
      return history;
    })
    .finally(() => historyRequests.delete(key));
  request.catch(() => {});
  historyRequests.set(key, request);
  return request;
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[var(--primary)]"
      />
      {children}
    </label>
  );
}

export function LeadEmailButton({
  orgSlug,
  lead,
  stages,
  settings,
  sender,
}: {
  orgSlug: string;
  lead: LeadRecord;
  stages: LeadStageRecord[];
  settings: CrmSettings;
  sender: LeadEmailSender;
}) {
  const [mode, setMode] = useState<"closed" | "open" | "sending">("closed");

  useEffect(() => {
    if (sender.configured) loadEmailHistory(orgSlug, lead.id, true).catch(() => {});
  }, [orgSlug, lead.id, sender.configured]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mode === "sending"}
        onClick={() => setMode("open")}
      >
        <Mail />
        {mode === "sending" ? "Sending…" : "Send email"}
      </Button>
      {mode !== "closed" ? (
        <LeadEmailComposer
          orgSlug={orgSlug}
          lead={lead}
          stages={stages}
          settings={settings}
          sender={sender}
          visible={mode === "open"}
          onSending={() => setMode("sending")}
          onSent={() => setMode("closed")}
          onFailed={() => setMode("open")}
          onClose={() => setMode("closed")}
        />
      ) : null}
    </>
  );
}

type Draft = {
  templateId: string | null;
  threadId: string | null;
  subject: string;
  body: string;
};

function LeadEmailComposer({
  orgSlug,
  lead,
  stages,
  settings,
  sender,
  visible,
  onSending,
  onSent,
  onFailed,
  onClose,
}: {
  orgSlug: string;
  lead: LeadRecord;
  stages: LeadStageRecord[];
  settings: CrmSettings;
  sender: LeadEmailSender;
  /** Hidden while sending; stays mounted so a failed send reopens with the draft intact. */
  visible: boolean;
  onSending: () => void;
  onSent: () => void;
  onFailed: () => void;
  onClose: () => void;
}) {
  const sending = useRef(false);
  const templates = settings.emailTemplates;
  const [history, setHistory] = useState<LeadEmailHistory | null>(
    () => historyCache.get(historyKey(orgSlug, lead.id)) ?? null,
  );
  const [initial] = useState(() => suggest(history ?? NO_HISTORY));
  const [suggestedId, setSuggestedId] = useState<string | null>(initial.suggestedId);
  const [draft, setDraft] = useState<Draft>(initial.draft);
  const touched = useRef(false);
  const [to, setTo] = useState(lead.email ?? "");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [track, setTrack] = useState(true);
  const [followUp, setFollowUp] = useState(true);
  const [followDays, setFollowDays] = useState(3);

  const open = openPipelineStages(stages);
  const nextStage = open[0]?.slug === lead.stage ? open[1] : undefined;
  const [advance, setAdvance] = useState(Boolean(nextStage));

  function compose(
    template: LeadEmailTemplate | null,
    known: LeadEmailHistory,
    threadId: string | null,
  ): Draft {
    const values = leadMergeValues(lead, { name: sender.name, orgName: sender.orgName });
    const thread = threadId ? known.previous.find((item) => item.id === threadId) : undefined;
    return {
      templateId: template?.id ?? null,
      threadId: thread?.id ?? null,
      subject: thread
        ? replySubject(thread.subject)
        : template
          ? fillTemplate(template.subject, values)
          : "",
      body: template ? fillTemplate(template.body, values) : "",
    };
  }

  function suggest(known: LeadEmailHistory) {
    const template = suggestTemplate(templates, {
      emailsSent: known.previous.length,
      proposalSent: known.proposalSent,
      quiet: isStale(lead, settings.staleDays),
    });
    const threadId = template && template.purpose !== "intro" ? (known.previous[0]?.id ?? null) : null;
    return { suggestedId: template?.id ?? null, draft: compose(template, known, threadId) };
  }

  function edit(next: Draft | ((current: Draft) => Draft)) {
    touched.current = true;
    setDraft(next);
  }

  useEffect(() => {
    if (history || !sender.configured) return;
    let cancelled = false;
    loadEmailHistory(orgSlug, lead.id)
      .then((loaded) => {
        if (cancelled) return;
        setHistory(loaded);
        const next = suggest(loaded);
        setSuggestedId(next.suggestedId);
        if (!touched.current) setDraft(next.draft);
      })
      .catch(() => {
        if (!cancelled) setHistory(NO_HISTORY);
      });
    return () => {
      cancelled = true;
    };
    // Runs once per open; the draft only follows the loaded history until the user edits it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, lead.id]);

  const known = history ?? NO_HISTORY;
  const lastEmail = known.previous[0] ?? null;
  const leftover = unfilledFields(`${draft.subject}\n${draft.body}`);
  const followOn = addDays(followDays);
  const firstName = lead.contactName?.trim().split(/\s+/)[0];
  const canSend =
    sender.configured &&
    Boolean(to.trim() && draft.subject.trim() && draft.body.trim()) &&
    leftover.length === 0;

  async function send() {
    if (!sender.configured || sending.current || !canSend) return;
    sending.current = true;
    onSending();
    const recipient = to.trim();
    const toastId = toast.loading(`Sending to ${recipient}…`);
    const followUpOn = followUp ? followOn : null;
    const movedTo = advance && nextStage ? nextStage : null;
    try {
      const result = await sendLeadEmailAction(orgSlug, lead.id, {
        to: recipient,
        cc: showCc ? cc : "",
        subject: draft.subject,
        body: draft.body,
        trackOpens: track,
        templateId: draft.templateId,
        replyToId: draft.threadId,
        followUp: followUpOn
          ? { text: `Follow up on “${draft.subject.replace(/^re:\s*/i, "")}”`, on: followUpOn }
          : null,
        moveToStage: movedTo?.slug ?? null,
      });
      if (result.error) {
        toast.error(result.error, { id: toastId });
        onFailed();
        return;
      }
      loadEmailHistory(orgSlug, lead.id, true).catch(() => {});
      toast.success(`Email sent to ${recipient}`, {
        id: toastId,
        description: [
          followUpOn ? `Follow-up set for ${dueLabel(followUpOn)}` : null,
          movedTo ? `Moved to ${movedTo.name}` : null,
          track ? "You’ll be notified when it’s opened" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      onSent();
    } catch {
      toast.error("Couldn’t send the email. Check your connection and try again.", { id: toastId });
      onFailed();
    } finally {
      sending.current = false;
    }
  }

  return (
    <Dialog
      open={visible}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email {firstName || lead.name}</DialogTitle>
          <DialogDescription>
            Sent from your address, logged on the timeline, and tracked when it’s opened.
          </DialogDescription>
        </DialogHeader>

        {!sender.configured ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Email isn’t set up on this workspace yet. Add SMTP_USER and SMTP_PASS to send from
            Worklane.
          </p>
        ) : (
          <div className="grid gap-3">
            {templates.length > 0 ? (
              <div role="radiogroup" aria-label="Template" className="flex flex-wrap gap-1.5">
                {templates.map((template) => {
                  const active = draft.templateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() =>
                        edit(
                          compose(
                            template,
                            known,
                            template.purpose !== "intro" ? draft.threadId : null,
                          ),
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors",
                        active
                          ? "bg-foreground text-background ring-foreground"
                          : "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground",
                      )}
                    >
                      {template.id === suggestedId ? <Sparkles className="size-3" /> : null}
                      {template.name}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="grid gap-2 rounded-xl ring-1 ring-foreground/8">
              <div className="flex items-center gap-2 border-b border-border/60 px-3">
                <span className="w-14 text-xs font-medium text-muted-foreground">To</span>
                <Input
                  type="email"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="name@company.com"
                  aria-label="To"
                  className="h-10 flex-1 border-0 bg-transparent px-0 shadow-none ring-0 hover:ring-0 focus-visible:ring-0"
                />
                {!showCc ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCc(true)}
                  >
                    Cc
                  </button>
                ) : null}
              </div>
              {showCc ? (
                <div className="flex items-center gap-2 border-b border-border/60 px-3">
                  <span className="w-14 text-xs font-medium text-muted-foreground">Cc</span>
                  <Input
                    value={cc}
                    onChange={(event) => setCc(event.target.value)}
                    placeholder="Separate addresses with commas"
                    aria-label="Cc"
                    className="h-10 flex-1 border-0 bg-transparent px-0 shadow-none ring-0 hover:ring-0 focus-visible:ring-0"
                  />
                </div>
              ) : null}
              <div className="flex items-center gap-2 border-b border-border/60 px-3">
                <span className="w-14 text-xs font-medium text-muted-foreground">Subject</span>
                <Input
                  value={draft.subject}
                  onChange={(event) => edit((current) => ({ ...current, subject: event.target.value }))}
                  maxLength={200}
                  aria-label="Subject"
                  className="h-10 flex-1 border-0 bg-transparent px-0 shadow-none ring-0 hover:ring-0 focus-visible:ring-0"
                />
              </div>
              <Textarea
                value={draft.body}
                onChange={(event) => edit((current) => ({ ...current, body: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    send();
                  }
                }}
                rows={12}
                maxLength={20_000}
                aria-label="Message"
                className="min-h-56 resize-y border-0 bg-transparent px-3 shadow-none ring-0 hover:ring-0 focus-visible:ring-0"
              />
            </div>

            {leftover.length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Fill in {leftover.map((key) => `{{${key}}}`).join(", ")} before sending.
              </p>
            ) : null}

            {lastEmail ? (
              <Toggle
                checked={Boolean(draft.threadId)}
                onChange={(checked) => {
                  const template = templates.find((item) => item.id === draft.templateId) ?? null;
                  const next = compose(template, known, checked ? lastEmail.id : null);
                  edit((current) => ({ ...current, threadId: next.threadId, subject: next.subject }));
                }}
              >
                <CornerUpLeft className="size-3.5 text-muted-foreground" />
                <span className="min-w-0 truncate">
                  Reply in the thread “{lastEmail.subject}”
                  <span className="text-muted-foreground">
                    {lastEmail.opened ? " · opened" : " · not opened yet"}
                  </span>
                </span>
              </Toggle>
            ) : null}

            <div className="grid gap-2.5 rounded-xl bg-muted/40 p-3">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                After sending
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Toggle checked={followUp} onChange={setFollowUp}>
                  Follow up if no reply in
                </Toggle>
                <div className="flex flex-wrap gap-1.5">
                  {FOLLOW_UP_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      aria-pressed={followUp && followDays === preset.days}
                      disabled={!followUp}
                      onClick={() => setFollowDays(preset.days)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors disabled:opacity-50",
                        followUp && followDays === preset.days
                          ? "bg-primary text-primary-foreground ring-primary"
                          : "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              {nextStage ? (
                <Toggle checked={advance} onChange={setAdvance}>
                  Move to {nextStage.name}
                </Toggle>
              ) : null}
              <Toggle checked={track} onChange={setTrack}>
                Track opens and notify me
              </Toggle>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={send} disabled={!canSend}>
            <Mail />
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
