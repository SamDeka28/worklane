export type TrackedEmail = {
  id: string;
  subject: string | null;
  recipient: string | null;
  leadId: string | null;
  leadName: string | null;
  createdBy: string;
  creatorName: string | null;
  createdAt: string;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  /** The pixel to paste into the email. */
  pixelUrl: string;
  /**
   * Loads the pixel as its sender so the sender's own network stops counting as opens.
   * Only set on the viewer's own pixels.
   */
  claimUrl: string | null;
  mine: boolean;
  /** Set when Worklane sent the email itself (Compose), rather than a pasted pixel. */
  sentAt: string | null;
  body: string | null;
  cc: string[];
};

export type EmailContact = { name: string; email: string; kind: "lead" | "contact" };

export type ComposeEmailInput = { to: string; cc: string; subject: string; body: string };

export type TrackedEmailOpen = { id: number; at: string; client: string | null };

export type TrackedEmailScope = "mine" | "all";
export type TrackedEmailStatus = "all" | "opened" | "waiting";

export function trackedEmailTitle(email: Pick<TrackedEmail, "subject" | "recipient">) {
  return email.subject?.trim() || (email.recipient ? `Email to ${email.recipient}` : "Untitled email");
}

/** Pastes as an invisible 1×1 image in Gmail, Outlook, and Apple Mail compose windows. */
export function pixelHtml(pixelUrl: string) {
  const src = pixelUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<img src="${src}" width="1" height="1" alt="" style="display:inline-block;width:1px;height:1px;border:0;outline:none" />`;
}
