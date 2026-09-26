import { listOrgMembers, requireOrg, type OrgContext } from "@/modules/identity/org";
import type { EmailContact, TrackedEmail, TrackedEmailScope } from "@/modules/emails/types";
import { mailPixelUrl } from "@/shared/email/pixel";

export const TRACKED_EMAIL_COLUMNS =
  "id, token, claim, subject, recipient, lead_id, created_by, created_at, open_count, first_opened_at, last_opened_at, sent_at, body, cc, leads ( name )";

type PixelRow = {
  id: string;
  token: string;
  claim: string;
  subject: string | null;
  recipient: string | null;
  lead_id: string | null;
  created_by: string;
  created_at: string;
  open_count: number | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  sent_at: string | null;
  body: string | null;
  cc: string[] | null;
  leads: { name: string | null } | { name: string | null }[] | null;
};

export function canSeeStudioEmails(ctx: Pick<OrgContext, "role">) {
  return ctx.role === "owner" || ctx.role === "admin";
}

export function mapTrackedEmail(
  row: PixelRow,
  viewerId: string,
  creatorName: string | null = null,
): TrackedEmail {
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
  const mine = row.created_by === viewerId;
  const pixelUrl = mailPixelUrl(row.token);
  return {
    id: row.id,
    subject: row.subject,
    recipient: row.recipient,
    leadId: row.lead_id,
    leadName: lead?.name ?? null,
    createdBy: row.created_by,
    creatorName,
    createdAt: row.created_at,
    openCount: Number(row.open_count ?? 0),
    firstOpenedAt: row.first_opened_at,
    lastOpenedAt: row.last_opened_at,
    pixelUrl,
    claimUrl: mine && !row.sent_at ? `${pixelUrl}&c=${encodeURIComponent(row.claim)}` : null,
    mine,
    sentAt: row.sent_at,
    body: row.body,
    cc: row.cc ?? [],
  };
}

/** Lead and client contact addresses to suggest in the Compose "To" field. */
export async function listEmailContacts(ctx: OrgContext): Promise<EmailContact[]> {
  const [{ data: leads }, { data: contacts }] = await Promise.all([
    ctx.org.modules.crm
      ? ctx.supabase
          .from("leads")
          .select("name, contact_name, email")
          .eq("organization_id", ctx.org.id)
          .not("email", "is", null)
          .order("updated_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
    ctx.supabase
      .from("contacts")
      .select("name, email")
      .eq("organization_id", ctx.org.id)
      .not("email", "is", null)
      .limit(300),
  ]);
  const seen = new Set<string>();
  const out: EmailContact[] = [];
  const add = (name: string | null, email: string | null, kind: EmailContact["kind"]) => {
    const address = email?.trim().toLowerCase();
    if (!address || seen.has(address)) return;
    seen.add(address);
    out.push({ name: name?.trim() || address, email: address, kind });
  };
  for (const row of leads ?? []) {
    add((row.contact_name as string | null) || (row.name as string | null), row.email as string | null, "lead");
  }
  for (const row of contacts ?? []) add(row.name as string | null, row.email as string | null, "contact");
  return out;
}

export async function listTrackedEmails(
  orgSlug: string,
  scope: TrackedEmailScope,
): Promise<TrackedEmail[]> {
  const ctx = await requireOrg(orgSlug);
  const everyone = scope === "all" && canSeeStudioEmails(ctx);
  let query = ctx.supabase
    .from("mail_pixels")
    .select(TRACKED_EMAIL_COLUMNS)
    .eq("organization_id", ctx.org.id)
    .order("created_at", { ascending: false })
    .limit(300);
  if (!everyone) query = query.eq("created_by", ctx.userId);

  const [{ data, error }, members] = await Promise.all([
    query,
    everyone ? listOrgMembers(orgSlug) : Promise.resolve([]),
  ]);
  if (error) throw new Error(error.message);
  const names = new Map(
    members.map((member) => [
      member.userId,
      member.displayName?.trim() || member.email?.split("@")[0] || null,
    ]),
  );
  return ((data ?? []) as unknown as PixelRow[]).map((row) =>
    mapTrackedEmail(row, ctx.userId, names.get(row.created_by) ?? null),
  );
}
