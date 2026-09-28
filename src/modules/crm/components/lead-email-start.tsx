"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Sparkles } from "lucide-react";
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
import { openLead, setCrmUrl } from "@/modules/crm/components/crm-url";
import {
  VariableChips,
  VariableField,
  insertVariableAt,
} from "@/modules/crm/components/email-variables";
import {
  AfterSending,
  BARE_FIELD,
  SenderNote,
} from "@/modules/crm/components/lead-email-composer";
import { startLeadWithEmailAction } from "@/modules/crm/email-actions";
import { findLeadDuplicatesAction } from "@/modules/crm/follow-actions";
import {
  addDays,
  companyFromEmail,
  dueLabel,
  fillTemplate,
  leadMergeValues,
  suggestTemplate,
  unfilledFields,
} from "@/modules/crm/presentation";
import type { LeadEmailSender } from "@/modules/crm/queries";
import type { CrmSettings } from "@/modules/crm/settings";
import { openPipelineStages, type LeadStageRecord } from "@/modules/crm/types";
import { ComposerSignature } from "@/modules/email-signatures/components/signature-forms";

const fieldClass = `h-11 w-full px-0 ${BARE_FIELD}`;

type Existing = { id: string; name: string };
type FieldElement = HTMLInputElement | HTMLTextAreaElement;

function Row({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 px-3.5", className)}>
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

/** Starts a lead by writing to them: sending creates the lead and logs the email on it. */
export function StartLeadEmailButton({
  orgSlug,
  stages,
  settings,
  sender,
}: {
  orgSlug: string;
  stages: LeadStageRecord[];
  settings: CrmSettings;
  sender: LeadEmailSender;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("compose") === "1";
  const [mode, setMode] = useState<"closed" | "open" | "sending">(requested ? "open" : "closed");
  const [session, setSession] = useState(0);
  const [syncedRequested, setSyncedRequested] = useState(requested);
  if (syncedRequested !== requested) {
    setSyncedRequested(requested);
    if (requested && mode === "closed") setMode("open");
  }

  function close() {
    setMode("closed");
    setCrmUrl({ compose: null });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={mode === "sending"}
        onClick={() => setMode("open")}
      >
        <Mail />
        {mode === "sending" ? "Sending…" : "Email a new lead"}
      </Button>
      {mode !== "closed" ? (
        <StartLeadEmailDialog
          key={session}
          orgSlug={orgSlug}
          stages={stages}
          settings={settings}
          sender={sender}
          visible={mode === "open"}
          onSending={() => setMode("sending")}
          onSent={() => {
            setMode("closed");
            setSession((value) => value + 1);
          }}
          onFailed={() => setMode("open")}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function StartLeadEmailDialog({
  orgSlug,
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
  const router = useRouter();
  const sending = useRef(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkedFor = useRef("");
  const subjectRef = useRef<FieldElement | null>(null);
  const bodyRef = useRef<FieldElement | null>(null);
  const lastField = useRef<FieldElement | null>(null);
  const templates = settings.emailTemplates;
  const [initial] = useState(() =>
    suggestTemplate(templates, { emailsSent: 0, proposalSent: false, quiet: false }),
  );
  const [templateId, setTemplateId] = useState<string | null>(initial?.id ?? null);
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [to, setTo] = useState("");
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [existing, setExisting] = useState<Existing | null>(null);
  const [track, setTrack] = useState(true);
  const [withSignature, setWithSignature] = useState(true);
  const [followUp, setFollowUp] = useState(true);
  const [followDays, setFollowDays] = useState(3);

  const nextStage = openPipelineStages(stages)[1];
  const [advance, setAdvance] = useState(Boolean(nextStage));

  const guessedCompany = companyFromEmail(to) ?? "";
  const companyName = company.trim() || guessedCompany;
  const contact = contactName.trim();
  const values = Object.fromEntries(
    Object.entries(
      leadMergeValues(
        { name: companyName || contact, company: companyName || null, contactName: contact || null },
        { name: sender.name, orgName: sender.orgName },
      ),
    ).filter(([, value]) => value),
  );
  const missing = unfilledFields(fillTemplate(`${subject}\n${body}`, values));
  const followOn = addDays(followDays);
  const canSend =
    sender.configured && Boolean(to.trim() && subject.trim() && body.trim()) && missing.length === 0;

  function insert(el: FieldElement, text: string) {
    if (el === subjectRef.current) insertVariableAt(el, subject, text, setSubject);
    else insertVariableAt(el, body, text, setBody);
  }

  async function checkExisting(email: string) {
    const address = email.trim().toLowerCase();
    checkedFor.current = address;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) return;
    const matches = await findLeadDuplicatesAction(orgSlug, { email: address }).catch(() => null);
    if (checkedFor.current !== address) return;
    const match = matches?.leads.find((lead) => lead.why === "Same email");
    setExisting(match ? { id: match.id, name: match.name } : null);
  }

  async function send() {
    if (!canSend || sending.current) return;
    sending.current = true;
    onSending();
    const recipient = to.trim();
    const toastId = toast.loading(`Sending to ${recipient}…`);
    const followUpOn = followUp ? followOn : null;
    const movedTo = advance && nextStage ? nextStage : null;
    const finalSubject = fillTemplate(subject, values);
    try {
      const result = await startLeadWithEmailAction(orgSlug, {
        to: recipient,
        cc: showCc ? cc : "",
        contactName: contact,
        company: companyName,
        subject: finalSubject,
        body: fillTemplate(body, values),
        trackOpens: track,
        includeSignature: withSignature && Boolean(sender.signature),
        templateId,
        followUp: followUpOn ? { text: `Follow up on “${finalSubject}”`, on: followUpOn } : null,
        moveToStage: movedTo?.slug ?? null,
      });
      if ("error" in result) {
        toast.error(result.error, { id: toastId });
        onFailed();
        return;
      }
      toast.success(`Lead created and email sent to ${recipient}`, {
        id: toastId,
        description: [
          followUpOn ? `Follow-up set for ${dueLabel(followUpOn)}` : null,
          movedTo ? `In ${movedTo.name}` : null,
          track ? "You’ll be notified when it’s opened" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      onSent();
      setCrmUrl({ new: null, stage: null, client: null, compose: null, lead: result.leadId });
      router.refresh();
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
          <DialogTitle>Email a new lead</DialogTitle>
          <DialogDescription>
            Sending adds them to your pipeline, with this email on their timeline.
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
                {templates.map((item) => {
                  const active = templateId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setTemplateId(item.id);
                        setSubject(item.subject);
                        setBody(item.body);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors",
                        active
                          ? "bg-foreground text-background ring-foreground"
                          : "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground",
                      )}
                    >
                      {item.purpose === "intro" ? <Sparkles className="size-3" /> : null}
                      {item.name}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="grid gap-2">
              <div className="overflow-visible rounded-xl ring-1 ring-foreground/10 [&>*+*]:border-t [&>*+*]:border-border/60">
                <Row label="To">
                  <Input
                    type="email"
                    value={to}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTo(value);
                      setExisting(null);
                      if (checkTimer.current) clearTimeout(checkTimer.current);
                      checkTimer.current = setTimeout(() => checkExisting(value), 600);
                    }}
                    placeholder="name@company.com"
                    aria-label="To"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-bwignore
                    autoFocus
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
                <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border/60 max-sm:[&>*+*]:border-t max-sm:[&>*+*]:border-border/60">
                  <Row label="Name">
                    <Input
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder="Optional"
                      aria-label="Contact name"
                      autoComplete="off"
                      maxLength={120}
                      className={fieldClass}
                    />
                  </Row>
                  <Row label="Company">
                    <Input
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder={guessedCompany || "Optional"}
                      aria-label="Company"
                      autoComplete="off"
                      maxLength={120}
                      className={fieldClass}
                    />
                  </Row>
                </div>
                <Row label="Subject">
                  <VariableField
                    value={subject}
                    onValueChange={setSubject}
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
                  value={body}
                  onValueChange={setBody}
                  values={values}
                  fieldRef={bodyRef}
                  onFocusField={(el) => (lastField.current = el)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  rows={10}
                  maxLength={20_000}
                  aria-label="Message"
                  placeholder="Write your email. Type @ to insert a variable."
                  className={`min-h-52 resize-y px-3.5 py-3 leading-6 ${BARE_FIELD}`}
                />
                <ComposerSignature
                  signature={sender.signature}
                  include={withSignature}
                  onIncludeChange={setWithSignature}
                  editHref={`/${orgSlug}/profile#signature`}
                />
              </div>
              <VariableChips values={values} target={lastField} fallback={bodyRef} onInsert={insert} />
            </div>

            {existing ? (
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-amber-700 dark:text-amber-300">
                {existing.name} is already a lead with this email.
                <button
                  type="button"
                  className="font-semibold underline underline-offset-2"
                  onClick={() => {
                    onClose();
                    openLead(existing.id);
                  }}
                >
                  Open it instead
                </button>
              </p>
            ) : null}

            {missing.length > 0 && to.trim() ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No value for {missing.map((key) => `{{${key}}}`).join(", ")}. Add a name or
                company above, or remove it from the email.
              </p>
            ) : null}

            <AfterSending
              followUp={followUp}
              onFollowUp={setFollowUp}
              followDays={followDays}
              onFollowDays={setFollowDays}
              stageToggle={
                nextStage ? { label: `Put the lead in ${nextStage.name}`, checked: advance, onChange: setAdvance } : null
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
              Send and create lead
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
