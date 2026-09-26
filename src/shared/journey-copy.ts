/** Journey copy: purpose lines, empties, and CTAs that teach the Lead→Client→Project→Money loop. */

export const JOURNEY = {
  home: {
    purpose: "Studio health: money, delivery, and pipeline",
  },
  leads: {
    purpose: "Opportunities before they become clients",
    primaryCta: "New lead",
    emptyTitle: "Add your first lead",
    emptyBody: "Capture the opportunity here. When you win, convert to a client without retyping.",
  },
  clients: {
    purpose: "Who you work with and bill",
    primaryCta: "New client",
    emptyTitle: "Add your first client",
    emptyBody: "Clients hold contacts, projects, and the ledger. Start here or convert a won lead.",
    emptyFromLeadHref: (orgSlug: string) => `/${orgSlug}/crm`,
  },
  projects: {
    purpose: "Active delivery: log work, bill milestones, run the board",
    primaryCta: "New project",
    emptyTitle: "Start a project",
    emptyBody: "Projects hang off a client. Log hours, bill milestones, then collect in Finance.",
    emptyNeedsClientTitle: "Add a client first",
    emptyNeedsClientBody: "Every project belongs to a client you can bill.",
  },
  documents: {
    purpose: "Proposals and SOWs for clients and projects",
    primaryCta: "New document",
    emptyTitle: "Create a proposal or SOW",
    emptyBody: "Draft freely. Accept or sign freezes a permanent copy.",
  },
  emails: {
    purpose: "Send tracked emails, or track the ones you send from Gmail, Outlook, or Apple Mail",
    primaryCta: "Track an email",
    emptyTitle: "Track your first email",
    emptyBody:
      "Compose one here, or create a pixel to paste into an email in your own mail app. You’ll see here when it’s opened.",
  },
  finance: {
    purpose: "Get paid: bill work, record what clients send, then see partner shares",
    primaryCta: "Collect",
    emptyCollectTitle: "Nothing to collect",
    emptyCollectBody: "Bill a milestone or add a charge, then record payment here.",
    emptyUpcomingTitle: "Nothing ready to bill",
    emptyUpcomingBody:
      "Add due dates and amounts on unbilled milestones. Bill posts a charge to Collect.",
    emptyUpcomingCta: "Open projects",
    emptyReceiptsTitle: "No money in yet",
    emptyReceiptsBody: "Record a payment on Collect. Receipts and partner shares land here.",
    emptyReceiptsCta: "Go to Collect",
  },
  partners: {
    purpose: "What partners earned versus settled",
    primaryCta: "Add partner",
    emptyTitle: "Add a partner",
    emptyBody: "Splits and settlements stay internal, never on the client portal.",
    emptyRegisterTitle: "No partner activity this month",
    emptyRegisterBody: "Post charges with a project split, or record a settlement.",
  },
  invoices: {
    purpose: "Draft, issue to the ledger, then send",
    primaryCta: "New invoice",
    emptyTitle: "No invoices yet",
    emptyBody: "Issue creates charges on the same ledger you collect against.",
  },
} as const;

export type JourneySurface = keyof typeof JOURNEY;
