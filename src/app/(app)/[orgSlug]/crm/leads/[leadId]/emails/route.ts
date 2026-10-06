import { NextResponse } from "next/server";
import { sendLeadEmailForContext } from "@/modules/crm/email-actions";
import type { SendLeadEmailInput } from "@/modules/crm/email-actions";
import { getLeadEmailHistory } from "@/modules/crm/queries";
import { requireWritableOrg } from "@/modules/identity/org";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A GET rather than a server action: actions run one at a time, so this would queue behind the sheet's other loads. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ orgSlug: string; leadId: string }> },
) {
  const { orgSlug, leadId } = await context.params;
  if (!UUID.test(leadId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await getLeadEmailHistory(orgSlug, leadId);
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * A route, not a server action: the action response waits to re-render the
 * whole CRM page, and actions run one at a time behind the sheet's other loads.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ orgSlug: string; leadId: string }> },
) {
  const { orgSlug, leadId } = await context.params;
  if (!UUID.test(leadId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let input: SendLeadEmailInput;
  try {
    input = (await request.json()) as SendLeadEmailInput;
  } catch {
    return NextResponse.json({ error: "Could not read that email" }, { status: 400 });
  }
  const ctx = await requireWritableOrg(orgSlug);
  const sent = await sendLeadEmailForContext(ctx, leadId, input);
  if ("error" in sent) return NextResponse.json(sent, { status: 400 });
  return NextResponse.json(sent);
}
