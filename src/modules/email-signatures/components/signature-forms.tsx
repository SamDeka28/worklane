"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PenLine } from "lucide-react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  savePersonalSignatureAction,
  saveStudioSignatureAction,
  setSignatureModuleAction,
} from "@/modules/email-signatures/actions";
import { SignatureEditor } from "@/modules/email-signatures/components/signature-editor";
import {
  renderSignature,
  type PersonalSignature,
  type RenderedSignature,
  type SignatureMode,
  type SignatureModule,
  type SignatureNode,
  type SignatureSender,
  type StudioSignature,
} from "@/modules/email-signatures/types";

/** The signature as it lands in an inbox: on white, whatever the app theme. */
export function SignaturePreview({ html, className }: { html: string | null; className?: string }) {
  if (!html) return null;
  return (
    <div
      className={cn(
        "rounded-xl bg-white px-4 py-3 text-[13px] leading-5 text-[#3d444d] ring-1 ring-border/40 [&_a]:text-[#1a73e8] [&_img]:inline-block [&_img]:max-w-full [&_ol]:list-decimal [&_ul]:list-disc",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** The signature under a composer's message, with a switch to leave it off this email. */
export function ComposerSignature({
  signature,
  include,
  onIncludeChange,
  editHref,
}: {
  signature: RenderedSignature | null;
  include: boolean;
  onIncludeChange: (next: boolean) => void;
  editHref: string;
}) {
  if (!signature) return null;
  return (
    <div className="grid gap-2 px-3.5 py-3">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
        <span>{include ? "Signature" : "No signature on this email"}</span>
        <span className="flex shrink-0 items-center gap-2">
          <a href={editHref} className="hover:text-foreground">
            Edit
          </a>
          <span aria-hidden>·</span>
          <button type="button" className="hover:text-foreground" onClick={() => onIncludeChange(!include)}>
            {include ? "Remove" : "Add signature"}
          </button>
        </span>
      </div>
      {include ? <SignaturePreview html={signature.html} className="max-h-48 overflow-y-auto" /> : null}
    </div>
  );
}

const MODULE_COPY: Record<SignatureModule, { title: string; on: string; off: string }> = {
  leads: {
    title: "Add signatures to lead emails",
    on: "Lead emails and Email a new lead get the sender's signature",
    off: "Lead emails go out without a signature",
  },
  emails: {
    title: "Add signatures to Compose emails",
    on: "Emails sent from Compose get the sender's signature",
    off: "Compose emails go out without a signature",
  },
};

/** Whether a module adds signatures. Owners and admins can switch it; everyone else sees the state. */
export function SignatureModuleSwitch({
  orgSlug,
  module,
  on,
  canEdit,
}: {
  orgSlug: string;
  module: SignatureModule;
  on: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(on);
  const copy = MODULE_COPY[module];
  const hint = canEdit ? (value ? copy.on : copy.off) : `${value ? copy.on : copy.off}. An owner or admin can change this.`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={!canEdit || pending}
      onClick={() => {
        const next = !value;
        setValue(next);
        start(async () => {
          const result = await setSignatureModuleAction(orgSlug, module, next);
          if ("error" in result) {
            setValue(!next);
            toast.error(result.error);
            return;
          }
          router.refresh();
        });
      }}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2.5 text-left ring-1 ring-border/25 transition-colors hover:bg-muted/55",
        !canEdit && "cursor-default hover:bg-muted/35",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium tracking-tight">{copy.title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{hint}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
          value ? "bg-primary" : "bg-muted-foreground/30",
          !canEdit && "opacity-60",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
            value ? "translate-x-4.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** A module's signature switch plus the sender's signature, opened from the module's toolbar. */
export function SignatureSheet({
  orgSlug,
  module,
  on,
  canEdit,
  html,
}: {
  orgSlug: string;
  module: SignatureModule;
  on: boolean;
  canEdit: boolean;
  html: string | null;
}) {
  return (
    <ActionSheet
      title="Signature"
      description="Added below the emails you send from here, like Gmail."
      triggerLabel="Signature"
      triggerVariant="ghost"
      triggerIcon={<PenLine />}
    >
      <div className="grid gap-5">
        <SignatureModuleSwitch orgSlug={orgSlug} module={module} on={on} canEdit={canEdit} />
        {on ? (
          <div className="grid gap-1.5">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Your signature
            </p>
            {html ? (
              <SignaturePreview html={html} />
            ) : (
              <p className="text-sm text-muted-foreground">You don’t have a signature yet.</p>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={`/${orgSlug}/profile#signature`} />}
          >
            Edit your signature
          </Button>
          {canEdit ? (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<a href={`/${orgSlug}/settings?tab=signature`} />}
            >
              Studio signature
            </Button>
          ) : null}
        </div>
      </div>
    </ActionSheet>
  );
}

/** The editor and a live preview side by side, saved together. */
function SignatureEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  orgSlug,
  initial,
  sender,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  orgSlug: string;
  initial: SignatureNode | null;
  sender: SignatureSender;
  onSave: (doc: SignatureNode | null) => Promise<boolean>;
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<SignatureNode | null>(initial);
  const rendered = renderSignature(draft, sender);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-y-auto p-0 sm:max-w-[min(84rem,calc(100%-4rem))] lg:min-h-[min(46rem,calc(100dvh-4rem))]">
        <DialogHeader className="gap-1 px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid flex-1 content-start gap-6 px-6 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          <div className="[&_.ProseMirror]:min-h-72 lg:[&_.ProseMirror]:min-h-[22rem]">
            <SignatureEditor orgSlug={orgSlug} value={draft} onChange={setDraft} />
          </div>
          <div className="grid content-start gap-1.5">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Preview for you
            </p>
            {rendered ? (
              <SignaturePreview html={rendered.html} />
            ) : (
              <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                Your signature shows here as you type.
              </p>
            )}
            <p className="text-[11px] leading-snug text-muted-foreground">
              Fields fill in with each sender&apos;s details. Empty fields drop out, with their line if nothing else is on it.
            </p>
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 mt-auto px-6 py-4">
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (await onSave(draft)) onOpenChange(false);
              })
            }
          >
            {pending ? "Saving…" : "Save signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A saved signature as it'll look, with the button that opens the editor. */
function SignatureCard({
  html,
  empty,
  onEdit,
  onRemove,
  disabled,
}: {
  html: string | null;
  empty: string;
  onEdit: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3">
      {html ? (
        <SignaturePreview html={html} />
      ) : (
        <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onEdit}>
          <PenLine />
          {html ? "Edit signature" : "Create signature"}
        </Button>
        {html && onRemove ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Owners and admins: the studio's default signature, and where it's added. */
export function StudioSignatureForm({
  orgSlug,
  saved,
  sender,
}: {
  orgSlug: string;
  saved: StudioSignature | null;
  sender: SignatureSender;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [doc, setDoc] = useState<SignatureNode | null>(saved?.doc ?? null);
  const [allowOverride, setAllowOverride] = useState(saved?.allowOverride ?? true);
  const [editing, setEditing] = useState(false);
  const html = renderSignature(doc, sender)?.html ?? null;

  async function save(next: { doc: SignatureNode | null; allowOverride: boolean }, success: string) {
    const result = await saveStudioSignatureAction(orgSlug, next);
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    setDoc(next.doc);
    setAllowOverride(next.allowOverride);
    toast.success(success);
    router.refresh();
    return true;
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <SignatureCard
          html={html}
          empty="No studio signature yet. Emails go out without one unless people add their own."
          disabled={pending}
          onEdit={() => setEditing(true)}
          onRemove={() => start(async () => void (await save({ doc: null, allowOverride }, "Studio signature removed")))}
        />
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={allowOverride}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.checked;
              start(async () => void (await save({ doc, allowOverride: next }, next ? "People can use their own signature" : "Everyone uses the studio signature")));
            }}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span>
            Let people use their own signature
            <span className="block text-xs text-muted-foreground">
              They can replace or turn off this one in their Profile. Off means everyone uses this signature.
            </span>
          </span>
        </label>
      </div>

      {editing ? (
        <SignatureEditorDialog
          open
          onOpenChange={setEditing}
          title="Studio signature"
          description="Everyone's default signature. Type @ to add fields that fill in for each sender."
          orgSlug={orgSlug}
          initial={doc}
          sender={sender}
          onSave={(next) =>
            save(
              { doc: next, allowOverride },
              renderSignature(next, sender) ? "Studio signature saved" : "Studio signature cleared",
            )
          }
        />
      ) : null}

      <div className="grid gap-2 border-t border-border/50 pt-6">
        <h3 className="text-sm font-semibold tracking-tight">Where signatures are added</h3>
        <p className="text-xs text-muted-foreground">
          Applies to everyone&apos;s signature, including their own. You can also switch these in the Leads and
          Emails modules.
        </p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <SignatureModuleSwitch orgSlug={orgSlug} module="leads" on={saved?.useInLeads ?? true} canEdit />
          <SignatureModuleSwitch orgSlug={orgSlug} module="emails" on={saved?.useInEmails ?? true} canEdit />
        </div>
      </div>
    </div>
  );
}

const MODES: { value: SignatureMode; label: string; hint: string }[] = [
  { value: "studio", label: "Studio signature", hint: "Use the one your studio set" },
  { value: "custom", label: "My own", hint: "Design your own" },
  { value: "none", label: "None", hint: "No signature" },
];

/** A member's own signature, or the studio's default. Choices save as you pick them. */
export function PersonalSignatureForm({
  orgSlug,
  studio,
  personal,
  sender,
}: {
  orgSlug: string;
  studio: StudioSignature | null;
  personal: PersonalSignature | null;
  sender: SignatureSender;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<SignatureMode>(personal?.mode ?? "studio");
  const [own, setOwn] = useState<SignatureNode | null>(personal?.doc ?? null);
  const [editing, setEditing] = useState(false);
  const studioHtml = renderSignature(studio?.doc ?? null, sender)?.html ?? null;
  const ownHtml = renderSignature(own, sender)?.html ?? null;
  const locked = studio?.allowOverride === false;

  async function save(next: { mode: SignatureMode; doc: SignatureNode | null }, success: string) {
    const result = await savePersonalSignatureAction(orgSlug, next);
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    setMode(next.mode);
    setOwn(next.doc);
    toast.success(success);
    router.refresh();
    return true;
  }

  if (locked) {
    return (
      <div className="grid gap-3 text-sm">
        <p className="text-muted-foreground">
          Your studio uses one signature for everyone. An owner or admin can change it in Settings.
        </p>
        <SignaturePreview html={studioHtml} />
      </div>
    );
  }

  function pick(next: SignatureMode) {
    if (next === mode) return;
    if (next === "custom" && !ownHtml) {
      setEditing(true);
      return;
    }
    const label = MODES.find((option) => option.value === next)?.label ?? "";
    start(async () => void (await save({ mode: next, doc: own }, `Signature set to ${label}`)));
  }

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Signature" className="grid gap-2 sm:grid-cols-3">
        {MODES.map((option) => {
          const active = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => pick(option.value)}
              className={cn(
                "rounded-2xl px-3 py-2.5 text-left ring-1 transition-colors disabled:opacity-60",
                active ? "bg-primary/12 ring-primary/35" : "bg-muted/50 ring-transparent hover:bg-muted",
              )}
            >
              <span className="block text-sm font-medium tracking-tight">{option.label}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.hint}</span>
            </button>
          );
        })}
      </div>

      {mode === "custom" ? (
        <SignatureCard
          html={ownHtml}
          empty="You haven't written a signature yet."
          disabled={pending}
          onEdit={() => setEditing(true)}
        />
      ) : mode === "studio" ? (
        studioHtml ? (
          <SignaturePreview html={studioHtml} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Your studio hasn’t set a signature yet, so emails go out without one.
          </p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Your emails go out without a signature.</p>
      )}

      {editing ? (
        <SignatureEditorDialog
          open
          onOpenChange={setEditing}
          title="Your signature"
          description="Added below the emails you send. Type @ to add fields like your phone or the studio address."
          orgSlug={orgSlug}
          initial={own ?? studio?.doc ?? null}
          sender={sender}
          onSave={(next) => save({ mode: "custom", doc: next }, "Signature saved")}
        />
      ) : null}
    </div>
  );
}
