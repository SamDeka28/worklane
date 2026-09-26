import { getAppUrl } from "@/shared/email";

/**
 * Open-tracking pixel for a tracked email. Served by the `mail-open` edge function on the
 * public Supabase host: mail clients load images through their own proxies, which can't
 * reach a local or private app URL.
 */
export function mailPixelUrl(token: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (supabase) return `${supabase}/functions/v1/mail-open?t=${encodeURIComponent(token)}`;
  return `${getAppUrl()}/portal/t/${token}`;
}
