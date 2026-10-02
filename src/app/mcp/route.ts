import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveAccessToken } from "@/modules/mcp/oauth";
import { requestOrigin } from "@/modules/mcp/origin";
import { createWorklaneMcpServer } from "@/modules/mcp/server";
import { createMemberSupabaseClient } from "@/modules/mcp/session";

export const runtime = "nodejs";

function unauthorized(origin: string) {
  return new Response(JSON.stringify({ error: "invalid_token" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer realm="worklane", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
    },
  });
}

async function handle(request: Request) {
  const origin = requestOrigin(request);
  const header = request.headers.get("authorization") ?? "";
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
  if (!token) return unauthorized(origin);
  const grant = await resolveAccessToken(token).catch(() => null);
  if (!grant) return unauthorized(origin);

  const server = createWorklaneMcpServer({
    supabase: createMemberSupabaseClient(grant.userId),
    userId: grant.userId,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
