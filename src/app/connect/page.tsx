import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { approveMcpAccessAction, denyMcpAccessAction } from "@/modules/mcp/actions";
import { clientAllowsRedirect, normalizeScope, resolveOauthClient } from "@/modules/mcp/oauth";
import { originFromHeaders } from "@/modules/mcp/origin";
import { oauthAuthorizePath } from "@/modules/mcp/return-path";
import { getSessionUser } from "@/shared/db/require-user";

export const metadata = {
  title: "Connect using MCP",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const value = (key: string) => (typeof query[key] === "string" ? query[key] : "");
  const clientId = value("client_id");
  const redirectUri = value("redirect_uri");
  const state = value("state");
  const codeChallenge = value("code_challenge");
  const method = value("code_challenge_method") || "S256";
  const responseType = value("response_type") || "code";
  const resource = value("resource");
  const scope = normalizeScope(value("scope"));
  const started = Boolean(clientId || redirectUri || codeChallenge);
  const origin = originFromHeaders(await headers()) ?? "";
  const params = new URLSearchParams({
    ...(clientId ? { client_id: clientId } : {}),
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    ...(value("response_type") ? { response_type: value("response_type") } : {}),
    ...(codeChallenge ? { code_challenge: codeChallenge } : {}),
    ...(value("code_challenge_method") ? { code_challenge_method: method } : {}),
    ...(state ? { state } : {}),
    ...(value("scope") ? { scope: value("scope") } : {}),
    ...(resource ? { resource } : {}),
  });
  const here = oauthAuthorizePath(params.size ? `/connect?${params.toString()}` : "/connect");
  const { user } = await getSessionUser();
  const client = started && clientId ? await resolveOauthClient(clientId) : null;
  const ready =
    Boolean(user) &&
    Boolean(client) &&
    responseType === "code" &&
    method === "S256" &&
    Boolean(codeChallenge) &&
    Boolean(scope) &&
    clientAllowsRedirect(client!, redirectUri);

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-lift ring-1 ring-border/60">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Worklane</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Connect using MCP</h1>
        {started && ready && client ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {client.clientName} is asking to read your studios.{" "}
              {scope?.includes("worklane:write")
                ? "Allowing this also lets it create, change, and send on your behalf, using the same access you already have."
                : "This connection can read only. Connect again from a write action if you want it to make changes."}{" "}
              You can disconnect it later from your profile.
            </p>
            <form action={approveMcpAccessAction} className="mt-6 flex flex-col gap-2">
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="state" value={state} />
              <input type="hidden" name="code_challenge" value={codeChallenge} />
              <input type="hidden" name="code_challenge_method" value={method} />
              <input type="hidden" name="scope" value={scope ?? ""} />
              <input type="hidden" name="response_type" value={responseType} />
              <input type="hidden" name="resource" value={resource} />
              <Button type="submit">Allow</Button>
            </form>
            <form action={denyMcpAccessAction} className="mt-2">
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="state" value={state} />
              <Button type="submit" variant="outline" className="w-full">
                Cancel
              </Button>
            </form>
          </>
        ) : started ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {client
                ? `${client.clientName} wants to connect. Sign in to Worklane to continue.`
                : "This connection request is missing a valid assistant, redirect, or security check."}
            </p>
            {client && here ? (
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  nativeButton={false}
                  render={<Link href={`/login?next=${encodeURIComponent(here)}`} />}
                >
                  Sign in to connect
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={`/signup?next=${encodeURIComponent(here)}`} />}
                >
                  Create an account
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Add Worklane as an app in ChatGPT on the web. Then you can mention it in a chat.
              ChatGPT opens this page, you sign in, and Worklane shares your studios. Reading is
              included. Changes need you to allow them on this page.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>In ChatGPT, open Settings, then Security and login, and turn on Developer mode.</li>
              <li>Open Plugins and choose the plus button. Paste this site&apos;s server address and create the plugin.</li>
              <li>When ChatGPT opens this page, sign in and allow access.</li>
              <li>Open the plugin under Personal and install it.</li>
              <li>On the ChatGPT homepage, switch from Chat to Work. In a new Work chat, type @ and select Worklane.</li>
            </ol>
            {origin ? (
              <p className="mt-4 font-mono text-xs text-foreground">{origin}/mcp</p>
            ) : null}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              A downloaded plugin zip only opens in the ChatGPT desktop app. It does not add an
              app you can mention in chat.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
