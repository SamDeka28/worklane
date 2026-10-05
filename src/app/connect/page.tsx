import { headers } from "next/headers";
import Link from "next/link";
import { CopyAddress } from "@/app/connect/copy-address";
import { PluginDownloadForm } from "@/app/connect/plugin-download-form";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { approveMcpAccessAction, denyMcpAccessAction } from "@/modules/mcp/actions";
import { clientAllowsRedirect, normalizeScope, resolveOauthClient } from "@/modules/mcp/oauth";
import { originFromHeaders } from "@/modules/mcp/origin";
import { PLUGIN_VERSION } from "@/modules/mcp/plugin-package";
import { oauthAuthorizePath } from "@/modules/mcp/return-path";
import { getSessionUser } from "@/shared/db/require-user";

export const metadata = {
  title: "Connect using MCP",
};

function redirectHost(uri: string) {
  try {
    return new URL(uri).host;
  } catch {
    return "";
  }
}

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

  if (!started) {
    const invalidAppId = value("plugin") === "invalid";
    const clients = [
      {
        name: "ChatGPT",
        steps: [
          "Open Settings, then Apps or Connectors, and add a custom MCP server.",
          "Paste the address below.",
          "When this page opens, sign in and allow access.",
        ],
      },
      {
        name: "Claude",
        steps: [
          "Open Customize, then Connectors, and add a custom connector.",
          "Paste the address below.",
          "When this page opens, sign in and allow access.",
        ],
      },
      {
        name: "Cursor",
        steps: [
          "Add a remote MCP server with the address below.",
          "When this page opens, sign in and allow access.",
        ],
      },
    ];
    return (
      <main className="min-h-svh px-4 py-16 sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mx-auto max-w-lg text-center">
            <BrandMark size={28} priority className="mx-auto" />
            <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">Connect an assistant</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Paste this address into ChatGPT, Claude, or Cursor. Sign in on this page when it asks.
              Reading is included. Allow changes when you want it to create, send, or update records.
            </p>
          </div>
          {origin ? (
            <div className="mx-auto mt-6 max-w-lg">
              <CopyAddress value={`${origin}/mcp`} />
            </div>
          ) : null}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {clients.map((client) => (
              <section key={client.name} className="rounded-3xl bg-card p-6 shadow-lift ring-1 ring-border/60">
                <h2 className="font-heading text-lg font-semibold tracking-tight">{client.name}</h2>
                <ol className="mt-4 space-y-3">
                  {client.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          <section className="mx-auto mt-4 max-w-xl rounded-3xl bg-card p-6 shadow-lift ring-1 ring-border/60 sm:p-8">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Optional</p>
            <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight">ChatGPT plugin</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A custom connection does not need this. Download version {PLUGIN_VERSION} only if you
              install Worklane as a ChatGPT plugin and want the packaged skill.
            </p>
            <PluginDownloadForm defaultAppId={value("app_id")} invalid={invalidAppId} />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-lift ring-1 ring-border/60">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Worklane</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">Connect using MCP</h1>
        {ready && client ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {client.clientName} is asking to read your studios
              {redirectHost(redirectUri) ? ` and will send you back to ${redirectHost(redirectUri)}` : ""}.{" "}
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
        ) : (
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
        )}
      </div>
    </main>
  );
}
