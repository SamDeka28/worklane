import { NextResponse } from "next/server";
import { getLeadEmailHistory } from "@/modules/crm/queries";

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
