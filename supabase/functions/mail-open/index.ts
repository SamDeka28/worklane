// Email open pixel. Lives on the public Supabase host so mail clients' image proxies
// (Gmail, Outlook, Apple Mail) can always fetch it, whatever the app's own URL is.
// Deploy with JWT verification off: mail clients send no auth header.

const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (char) => char.charCodeAt(0),
);

const HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(PIXEL.length),
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

function mailClient(userAgent: string) {
  if (/GoogleImageProxy|ggpht\.com/i.test(userAgent)) return "Gmail";
  if (/YahooMailProxy/i.test(userAgent)) return "Yahoo Mail";
  if (/Outlook|Microsoft Office|ms-office|MSOffice/i.test(userAgent)) return "Outlook";
  if (/Thunderbird/i.test(userAgent)) return "Thunderbird";
  if (/iPhone|iPad|Macintosh/i.test(userAgent) && !/Chrome|Firefox|Edg\//i.test(userAgent)) {
    return "Apple Mail";
  }
  return userAgent ? "Browser or other app" : null;
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip");
}

async function record(body: Record<string, string | null>) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/rpc/track_mail_open`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Tracking must never break the image.
  }
}

Deno.serve(async (request) => {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const token = (url.searchParams.get("t") ?? url.pathname.split("/").pop() ?? "")
      .replace(/\.gif$/, "");
    const claim = url.searchParams.get("c");
    if (TOKEN.test(token)) {
      await record({
        p_token: token,
        p_ip: clientIp(request),
        p_client: mailClient(request.headers.get("user-agent") ?? ""),
        p_claim: claim && TOKEN.test(claim) ? claim : null,
      });
    }
  }
  return new Response(PIXEL, { status: 200, headers: HEADERS });
});
