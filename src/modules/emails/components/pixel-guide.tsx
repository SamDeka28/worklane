"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, CircleHelp } from "lucide-react";
import { ActionSheet } from "@/components/studio/action-sheet";
import { cn } from "@/lib/utils";

type MailApp = "gmail" | "outlook-web" | "outlook-desktop" | "apple" | "phone";

const APP_KEY = "worklane:pixel-mail-app";

const APPS: { id: MailApp; label: string; steps: string[]; note?: string }[] = [
  {
    id: "gmail",
    label: "Gmail",
    steps: [
      "Compose your email in Gmail on the web.",
      "Click in the body where the pixel should go. Just above your signature works well.",
      "Press ⌘V (Ctrl+V on Windows). Nothing visible appears; the pixel is invisible.",
      "Send as usual.",
    ],
    note: "Don’t use Plain text mode (⋮ menu in the compose window). It strips images, including the pixel.",
  },
  {
    id: "outlook-web",
    label: "Outlook web",
    steps: [
      "Compose in Outlook on the web or the new Outlook app.",
      "Click in the body and press ⌘V (Ctrl+V on Windows).",
      "Send as usual.",
    ],
    note: "The message must be HTML. If it’s plain text, switch it in the compose window’s ⋯ menu → Switch to HTML.",
  },
  {
    id: "outlook-desktop",
    label: "Outlook classic",
    steps: [
      "Click in the body and press Ctrl+V. This usually works.",
      "If nothing is inserted, click Copy link only in Worklane instead.",
      "In Outlook, go to Insert → Pictures → This Device and paste the link into the File name box.",
      "Open the arrow next to Insert and choose Link to File, so the image stays hosted and can report opens.",
    ],
    note: "Choosing plain Insert embeds a copy of the image, which can’t report opens.",
  },
  {
    id: "apple",
    label: "Apple Mail",
    steps: [
      "Compose a new message in Mail on your Mac.",
      "Click in the body and press ⌘V.",
      "Send as usual.",
    ],
    note: "The message must be Rich Text (the default). If it isn’t, choose Format → Make Rich Text.",
  },
  {
    id: "phone",
    label: "Phone",
    steps: [
      "Most phone mail apps can’t paste images from the clipboard.",
      "Write the email on a computer and paste the pixel there.",
      "Save it as a draft if you want to send it later from your phone.",
    ],
  },
];

function initialApp(): MailApp {
  if (typeof window === "undefined") return "gmail";
  const saved = window.localStorage.getItem(APP_KEY);
  return APPS.some((app) => app.id === saved) ? (saved as MailApp) : "gmail";
}

/** Paste steps for each mail app; remembers the last app picked. */
export function MailAppSteps({ compact = false }: { compact?: boolean }) {
  const [app, setApp] = useState<MailApp>(initialApp);
  const current = APPS.find((item) => item.id === app) ?? APPS[0];

  function pick(next: MailApp) {
    setApp(next);
    window.localStorage.setItem(APP_KEY, next);
  }

  return (
    <div className="grid gap-3">
      <div role="radiogroup" aria-label="Your mail app" className="flex flex-wrap gap-1.5">
        {APPS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={item.id === app}
            onClick={() => pick(item.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              item.id === app
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ol className={cn("grid gap-1.5 text-sm", compact ? "text-muted-foreground" : "")}>
        {current.steps.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="w-4 shrink-0 font-medium text-foreground tabular-nums">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {current.note ? <p className="text-xs text-muted-foreground">{current.note}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PixelGuideButton() {
  return (
    <ActionSheet
      title="How it works"
      description="See when the emails you send are opened."
      triggerLabel="How it works"
      triggerVariant="ghost"
      triggerIcon={<CircleHelp />}
    >
      <div className="grid gap-7">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              title: "Compose",
              body: "Write and send from Worklane. Tracking is automatic; replies come to your email.",
            },
            {
              title: "Track an email",
              body: "Get a pixel and paste it into an email you send from your own mail app.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl bg-muted/50 p-3">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
        <Section title="Pasting the pixel">
          <MailAppSteps />
        </Section>
        <Section title="Good to know">
          <ul className="grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
            <li>Use a new pixel for every email.</li>
            <li>
              Your own opens are ignored. If one slips through, click{" "}
              <span className="font-medium text-foreground">This was me</span> on it.
            </li>
            <li>Some apps load images automatically and others block them, so treat opens as a signal.</li>
          </ul>
        </Section>
        <Link
          href="/docs/email-tracking"
          target="_blank"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <BookOpen className="size-4" />
          Read the full guide in the docs
        </Link>
      </div>
    </ActionSheet>
  );
}
