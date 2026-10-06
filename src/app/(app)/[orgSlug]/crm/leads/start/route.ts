import { NextResponse } from "next/server";
import { startLeadWithEmailForContext, type StartLeadEmailInput } from "@/modules/crm/email-actions";
import { requireWritableOrg } from "@/modules/identity/org";

/**
 * A route, not a server action: the action response waits to re-render the
 * whole CRM page, and actions run one at a time behind the page's other loads.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  const { orgSlug } = await context.params;
  let input: StartLeadEmailInput;
  try {
    input = (await request.json()) as StartLeadEmailInput;
  } catch {
    return NextResponse.json({ error: "Could not read that email" }, { status: 400 });
  }
  const ctx = await requireWritableOrg(orgSlug);
  const started = await startLeadWithEmailForContext(ctx, input);
  if ("error" in started) return NextResponse.json(started, { status: 400 });
  return NextResponse.json(started);
}
