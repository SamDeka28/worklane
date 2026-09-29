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
import { cn } from "@/lib/utils";
import {
  VariableChips,
  VariableField,
  insertVariableAt,
} from "@/modules/crm/components/email-variables";
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
import { ComposerSignature } from "@/modules/email-signatures/components/signature-forms";
import { EmailAttachments } from "@/modules/emails/components/email-attachments";
import type { EmailAttachmentPayload } from "@/modules/emails/types";

/** Fields inside the composer box: the box draws the frame, so the themed well is switched off. */
export const BARE_FIELD =
  "rounded-none! border-0 bg-transparent! shadow-none! ring-0 backdrop-blur-none! hover:ring-0 focus-visible:ring-0";

const FOLLOW_UP_PRESETS = [
  { label: "2 days", days: 2 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
];

const fieldClass = `h-11 w-full px-0 ${BARE_FIELD}`;

const NO_HISTORY: LeadEmailHistory = { proposalSent: false, previous: [] };
const historyCache = new Map<string, LeadEmailHistory>();
const historyRequests = new Map<string, Promise<LeadEmailHistory>>();

const historyKey = (orgSlug: string, leadId: string) => `${orgSlug}/${leadId}`;

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-3.5">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

export function AfterSending({
  followUp,
  onFollowUp,
  followDays,
  onFollowDays,
  stageToggle,
  track,
  onTrack,
}: {
  followUp: boolean;
  onFollowUp: (value: boolean) => void;
  followDays: number;
  onFollowDays: (value: number) => void;
  stageToggle: { label: string; checked: boolean; onChange: (value: boolean) => void } | null;
  track: boolean;
  onTrack: (value: boolean) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl bg-muted/40 px-3.5 py-3">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        After sending
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Toggle checked={followUp} onChange={onFollowUp}>
          Follow up if no reply in
        </Toggle>
        <div className="flex flex-wrap gap-1.5">
          {FOLLOW_UP_PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              aria-pressed={followUp && followDays === preset.days}
              disabled={!followUp}
              onClick={() => onFollowDays(preset.days)}
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
      {stageToggle ? (
        <Toggle checked={stageToggle.checked} onChange={stageToggle.onChange}>
          {stageToggle.label}
        </Toggle>
      ) : null}
      <Toggle checked={track} onChange={onTrack}>
        Track opens and notify me
      </Toggle>
    </div>
  );
}

export function SenderNote({ sender }: { sender: LeadEmailSender }) {
  if (!sender.configured || !sender.fromAddress) return <span />;
  return (
    <p className="min-w-0 truncate text-xs text-muted-foreground">
      From <span className="font-medium text-foreground">{sender.fromAddress}</span>
      {sender.via === "personal"
        ? " (your SMTP)"
        : sender.via === "studio"
          ? " (studio SMTP)"
          : ""}
      {sender.email && sender.via !== "personal" ? ` · replies to ${sender.email}` : ""}
    </p>
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
  const subjectRef = useRef<FieldElement | null>(null);
  const bodyRef = useRef<FieldElement | null>(null);
  const lastField = useRef<FieldElement | null>(null);
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
  const [withSignature, setWithSignature] = useState(true);
  const [attachments, setAttachments] = useState<EmailAttachmentPayload[]>([]);
  const [followUp, setFollowUp] = useState(true);
  const [followDays, setFollowDays] = useState(3);

  const open = openPipelineStages(stages);
  const nextStage = open[0]?.slug === lead.stage ? open[1] : undefined;
  const [advance, setAdvance] = useState(Boolean(nextStage));

  const values = Object.fromEntries(
    Object.entries(leadMergeValues(lead, { name: sender.name, orgName: sender.orgName })).filter(
      ([, value]) => value,
    ),
  );

  function compose(
    template: LeadEmailTemplate | null,
    known: LeadEmailHistory,
    threadId: string | null,
  ): Draft {
    const thread = threadId ? known.previous.find((item) => item.id === threadId) : undefined;
    return {
      templateId: template?.id ?? null,
      threadId: thread?.id ?? null,
      subject: thread ? replySubject(thread.subject) : (template?.subject ?? ""),
      body: template?.body ?? "",
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

  function insert(el: FieldElement, text: string) {
    if (el === subjectRef.current) {
      insertVariableAt(el, draft.subject, text, (subject) => edit((current) => ({ ...current, subject })));
    } else {
      insertVariableAt(el, draft.body, text, (body) => edit((current) => ({ ...current, body })));
    }
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
  const missing = unfilledFields(fillTemplate(`${draft.subject}\n${draft.body}`, values));
  const followOn = addDays(followDays);
  const firstName = lead.contactName?.trim().split(/\s+/)[0];
  const canSend =
    sender.configured &&
    Boolean(to.trim() && draft.subject.trim() && draft.body.trim()) &&
    missing.length === 0;

  async function send() {
    if (!sender.configured || sending.current || !canSend) return;
    sending.current = true;
    onSending();
    const recipient = to.trim();
    const toastId = toast.loading(`Sending to ${recipient}…`);
    const followUpOn = followUp ? followOn : null;
    const movedTo = advance && nextStage ? nextStage : null;
    const subject = fillTemplate(draft.subject, values);
    try {
      const result = await sendLeadEmailAction(orgSlug, lead.id, {
        to: recipient,
        cc: showCc ? cc : "",
        subject,
        body: fillTemplate(draft.body, values),
        trackOpens: track,
        includeSignature: withSignature && Boolean(sender.signature),
        templateId: draft.templateId,
        replyToId: draft.threadId,
        followUp: followUpOn
          ? { text: `Follow up on “${subject.replace(/^re:\s*/i, "")}”`, on: followUpOn }
          : null,
        moveToStage: movedTo?.slug ?? null,
        attachments,
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
      <DialogContent className="max-h-[92dvh] grid-cols-[minmax(0,1fr)] gap-5 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Email {firstName || lead.name}</DialogTitle>
          <DialogDescription>
            Logged on the timeline and tracked when it’s opened.
          </DialogDescription>
        </DialogHeader>

        {!sender.configured ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Email sending isn’t set up yet. Connect a mailbox in CRM settings → Mailbox, or ask
            an owner or admin to connect the studio’s in Settings.
          </p>
        ) : (
          <div className="grid gap-4">
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

            <div className="grid gap-2">
              <div className="rounded-xl ring-1 ring-foreground/10 [&>*+*]:border-t [&>*+*]:border-border/60">
                <Row label="To">
                  <Input
                    type="email"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    placeholder="name@company.com"
                    aria-label="To"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-bwignore
                    className={fieldClass}
                  />
                  {!showCc ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
                      onClick={() => setShowCc(true)}
                    >
                      Cc
                    </button>
                  ) : null}
                </Row>
                {showCc ? (
                  <Row label="Cc">
                    <Input
                      value={cc}
                      onChange={(event) => setCc(event.target.value)}
                      placeholder="Separate addresses with commas"
                      aria-label="Cc"
                      autoComplete="off"
                      className={fieldClass}
                    />
                  </Row>
                ) : null}
                <Row label="Subject">
                  <VariableField
                    value={draft.subject}
                    onValueChange={(subject) => edit((current) => ({ ...current, subject }))}
                    values={values}
                    fieldRef={subjectRef}
                    onFocusField={(el) => (lastField.current = el)}
                    maxLength={200}
                    aria-label="Subject"
                    autoComplete="off"
                    wrapperClassName="w-full"
                    className={fieldClass}
                  />
                </Row>
                <VariableField
                  multiline
                  value={draft.body}
                  onValueChange={(body) => edit((current) => ({ ...current, body }))}
                  values={values}
                  fieldRef={bodyRef}
                  onFocusField={(el) => (lastField.current = el)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  rows={12}
                  maxLength={20_000}
                  aria-label="Message"
                  placeholder="Write your email. Type @ to insert a variable."
                  className={`min-h-56 resize-y px-3.5 py-3 leading-6 ${BARE_FIELD}`}
                />
                <ComposerSignature
                  signature={sender.signature}
                  include={withSignature}
                  onIncludeChange={setWithSignature}
                  editHref={`/${orgSlug}/profile#signature`}
                />
              </div>
              <VariableChips values={values} target={lastField} fallback={bodyRef} onInsert={insert} />
              <EmailAttachments value={attachments} onChange={setAttachments} disabled={sending.current} />
            </div>

            {missing.length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This lead has no value for {missing.map((key) => `{{${key}}}`).join(", ")}. Fill
                it in on the lead or remove it from the email.
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

            <AfterSending
              followUp={followUp}
              onFollowUp={setFollowUp}
              followDays={followDays}
              onFollowDays={setFollowDays}
              stageToggle={
                nextStage
                  ? { label: `Move to ${nextStage.name}`, checked: advance, onChange: setAdvance }
                  : null
              }
              track={track}
              onTrack={setTrack}
            />
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <SenderNote sender={sender} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={send} disabled={!canSend}>
              <Mail />
              Send
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
