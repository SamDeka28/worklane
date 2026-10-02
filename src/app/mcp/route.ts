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
      "WWW-Authenticate": `Bearer realm="worklane", error="invalid_token", error_description="You need to login to continue", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}

/** ChatGPT shows Connect only when each tool advertises oauth2 on tools/list. */
async function advertiseOauth(response: Response) {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return response;
  const body = await response.clone().json().catch(() => null);
  if (!body || !Array.isArray(body.result?.tools)) return response;
  for (const tool of body.result.tools) {
    tool.securitySchemes = [{ type: "oauth2", scopes: ["worklane:read"] }];
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(body, { status: response.status, headers });
}

async function handle(request: Request) {
  const origin = requestOrigin(request);
  const header = request.headers.get("authorization") ?? "";
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
  const grant = token ? await resolveAccessToken(token).catch(() => null) : null;
  if (token && !grant) return unauthorized(origin);

  const server = createWorklaneMcpServer({
    origin,
    reader: grant
      ? { supabase: createMemberSupabaseClient(grant.userId), userId: grant.userId }
      : null,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return advertiseOauth(await transport.handleRequest(request));
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
