import { after } from "next/server";
import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export const dynamic = "force-dynamic";

/** Older emails point here; new ones use the `mail-open` edge function (see `mailPixelUrl`). */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  after(async () => {
    const admin = createAdminSupabaseClient();
    if (admin && /^[A-Za-z0-9_-]{16,128}$/.test(token)) {
      await admin.rpc("track_mail_open", { p_token: token });
    }
  });
  return new Response(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
