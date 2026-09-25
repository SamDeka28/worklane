"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateNotificationPrefsAction } from "@/modules/notifications/actions";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_META,
  emailEnabled,
  type NotificationCategory,
  type NotificationPrefs,
} from "@/modules/notifications/types";

export function NotificationPrefsForm({
  orgSlug,
  prefs,
  emailConfigured,
}: {
  orgSlug: string;
  prefs: NotificationPrefs;
  emailConfigured: boolean;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<Record<NotificationCategory, boolean>>(
    () =>
      Object.fromEntries(
        NOTIFICATION_CATEGORIES.map((category) => [
          category,
          emailEnabled(prefs, category),
        ]),
      ) as Record<NotificationCategory, boolean>,
  );

  return (
    <form
      className="grid gap-3"
      action={(formData) => {
        start(async () => {
          const result = await updateNotificationPrefsAction(orgSlug, formData);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          toast.success("Notification settings saved");
        });
      }}
    >
      <div className="grid gap-0.5">
        {NOTIFICATION_CATEGORIES.map((category) => {
          const meta = NOTIFICATION_CATEGORY_META[category];
          const on = state[category];
          return (
            <label
              key={category}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {meta.description}
                </span>
              </span>
              <input
                type="checkbox"
                name={`email_${category}`}
                checked={on}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    [category]: event.target.checked,
                  }))
                }
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40",
                  on ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                    on ? "translate-x-4.5" : "translate-x-0.5",
                  )}
                />
              </span>
            </label>
          );
        })}
      </div>
      {!emailConfigured ? (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Email isn’t configured for this deployment, so only in-app
          notifications are sent.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Saving…" : "Save email settings"}
      </Button>
    </form>
  );
}
