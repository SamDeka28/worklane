/** Next action for a client hub — one primary CTA. */

export type ClientNextStep = {
  title: string;
  body: string;
  cta: string;
  /** Query/path suffix relative to /{org}/clients/{id} or absolute path */
  href: "new-project" | "collect" | "add-contact" | "open-project";
  projectId?: string;
};

export function clientNextStep(input: {
  projectCount: number;
  outstandingMinor: bigint;
  contactCount: number;
  latestProjectId?: string | null;
}): ClientNextStep {
  if (input.projectCount === 0) {
    return {
      title: "Start a project",
      body: "Delivery, milestones, and billing hang off a project for this client.",
      cta: "New project",
      href: "new-project",
    };
  }
  if (input.outstandingMinor > BigInt(0)) {
    return {
      title: "Collect what’s owed",
      body: "Open charges are waiting on the ledger for this client.",
      cta: "Collect",
      href: "collect",
    };
  }
  if (input.contactCount === 0) {
    return {
      title: "Add a contact",
      body: "Who you email or WhatsApp for this engagement.",
      cta: "Add contact",
      href: "add-contact",
    };
  }
  if (input.latestProjectId) {
    return {
      title: "Continue delivery",
      body: "Open the latest project to log work, bill, or collect.",
      cta: "Open project",
      href: "open-project",
      projectId: input.latestProjectId,
    };
  }
  return {
    title: "Client is set up",
    body: "Add another project when the next engagement starts.",
    cta: "New project",
    href: "new-project",
  };
}
