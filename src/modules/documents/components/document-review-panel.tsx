"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  replyDocumentFeedbackAction,
  resolveDocumentFeedbackAction,
} from "@/modules/documents/actions";
import type { DocumentFeedback, DocumentSend } from "@/modules/documents/sends";

const KIND_LABEL: Record<DocumentFeedback["kind"], string> = {
  comment: "Comment",
  suggestion: "Suggested edit",
  changes_requested: "Changes requested",
  reply: "Reply",
  signed: "Signed",
};

const KIND_TONE: Record<DocumentFeedback["kind"], string> = {
  comment: "bg-muted text-muted-foreground",
  suggestion: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  changes_requested: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  reply: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  signed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
};

function when(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function openFeedbackCount(feedback: DocumentFeedback[]) {
  return feedback.filter(
    (item) => item.authorType === "client" && item.kind !== "signed" && !item.resolvedAt,
  ).length;
}

export function DocumentReviewPanel({
  orgSlug,
  documentId,
  feedback,
  sends,
  canWrite,
}: {
  orgSlug: string;
  documentId: string;
  feedback: DocumentFeedback[];
  sends: DocumentSend[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const replyTargets = useMemo(() => {
    const seen = new Set<string>();
    return sends.filter((send) => {
      if (send.revokedAt || seen.has(send.recipientEmail)) return false;
      seen.add(send.recipientEmail);
      return true;
    });
  }, [sends]);
  const latestClientSend = [...feedback].reverse().find((item) => item.authorType === "client")?.sendId;
  const [sendId, setSendId] = useState(
    () => (replyTargets.find((s) => s.id === latestClientSend) ?? replyTargets[0])?.id ?? "",
  );

  const resolvedCount = feedback.filter((item) => item.resolvedAt).length;
  const visible = showResolved ? feedback : feedback.filter((item) => !item.resolvedAt);

  return (
    <div className="grid gap-3">
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {feedback.length === 0 ? "No client feedback yet." : "Everything is addressed."}
        </p>
      ) : (
        <ol className="grid max-h-[26rem] gap-2 overflow-y-auto pr-0.5">
          {visible.map((item) => {
            const resolvable =
              canWrite && item.authorType === "client" && item.kind !== "signed";
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-xs ring-1 ring-border/40",
                  item.authorType === "studio" ? "bg-violet-500/5" : "bg-muted/30",
                  item.resolvedAt && "opacity-60",
                )}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-foreground">
                    {item.authorName ?? item.authorEmail ?? "Client"}
                  </span>
                  <span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", KIND_TONE[item.kind])}>
                    {KIND_LABEL[item.kind]}
                  </span>
                  {item.versionNumber ? (
                    <span className="text-muted-foreground">v{item.versionNumber}</span>
                  ) : null}
                  <span className="ml-auto text-muted-foreground">{when(item.createdAt)}</span>
                </div>
                {item.quote ? (
                  <p
                    className={cn(
                      "mb-1 border-l-2 border-amber-400/70 pl-2 italic text-muted-foreground",
                      item.kind === "suggestion" && "line-through decoration-rose-400/70",
                    )}
                  >
                    “{item.quote}”
                  </p>
                ) : null}
                {item.kind === "suggestion" && item.suggestion ? (
                  <p className="mb-1 border-l-2 border-emerald-500/70 pl-2 text-emerald-700 dark:text-emerald-300">
                    {item.suggestion}
                  </p>
                ) : null}
                {item.body && item.kind !== "signed" ? (
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{item.body}</p>
                ) : null}
                {resolvable ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      start(async () => {
                        const result = await resolveDocumentFeedbackAction(
                          orgSlug,
                          item.id,
                          !item.resolvedAt,
                        );
                        if ("error" in result && result.error) toast.error(result.error);
                        else router.refresh();
                      })
                    }
                  >
                    {item.resolvedAt ? (
                      <>
                        <RotateCcw className="size-3" /> Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3" /> Mark addressed
                      </>
                    )}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {resolvedCount > 0 ? (
        <button
          type="button"
          className="justify-self-start text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setShowResolved((value) => !value)}
        >
          {showResolved ? "Hide addressed" : `Show ${resolvedCount} addressed`}
        </button>
      ) : null}

      {canWrite && replyTargets.length > 0 ? (
        <form
          className="grid gap-2 border-t border-border/40 pt-3"
          action={(formData) => {
            formData.set("send_id", sendId);
            start(async () => {
              const result = await replyDocumentFeedbackAction(orgSlug, documentId, formData);
              if ("error" in result && result.error) {
                toast.error(result.error);
                return;
              }
              toast.success(result.emailed ? "Reply sent and emailed" : "Reply posted");
              setBody("");
              router.refresh();
            });
          }}
        >
          {replyTargets.length > 1 ? (
            <NativeSelect value={sendId} onChange={(event) => setSendId(event.target.value)}>
              {replyTargets.map((send) => (
                <option key={send.id} value={send.id}>
                  To {send.recipientName ? `${send.recipientName} (${send.recipientEmail})` : send.recipientEmail}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <Textarea
            name="body"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Reply to the client…"
            className="text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input type="checkbox" name="email_client" value="on" defaultChecked className="rounded border-input" />
              Email the client
            </label>
            <Button type="submit" size="sm" variant="secondary" disabled={pending || !body.trim()}>
              {pending ? "Sending…" : "Reply"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
