import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveAccessToken } from "@/modules/mcp/oauth";
import { requestOrigin } from "@/modules/mcp/origin";
import { createWorklaneMcpServer } from "@/modules/mcp/server";
import { createMemberSupabaseClient } from "@/modules/mcp/session";

export const runtime = "nodejs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

/** ChatGPT shows Connect only when each tool advertises oauth2 on tools/list. */
async function advertiseOauth(response: Response) {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return response;
  const body = await response.clone().json().catch(() => null);
  if (!body || !Array.isArray(body.result?.tools)) return response;
  for (const tool of body.result.tools) {
    const advertised = tool._meta?.securitySchemes ?? tool.securitySchemes;
    tool.securitySchemes = Array.isArray(advertised) && advertised.length > 0
      ? advertised
      : [{ type: "oauth2", scopes: ["worklane:read"] }];
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return Response.json(body, { status: response.status, headers });
}

function methodNotAllowed() {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "POST, OPTIONS",
        ...cors,
      },
    },
  );
}

/** Stateless JSON only. A long-lived GET stream never finishes on the host, so ChatGPT never loads the app. */
export function GET() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...cors,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Allow: "POST, OPTIONS",
    },
  });
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

async function handle(request: Request) {
  const origin = requestOrigin(request);
  const header = request.headers.get("authorization") ?? "";
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
  const grant = token ? await resolveAccessToken(token).catch(() => null) : null;

  const server = createWorklaneMcpServer({
    origin,
    reader: grant
      ? {
          supabase: createMemberSupabaseClient(grant.userId),
          userId: grant.userId,
          scopes: grant.scopes,
        }
      : null,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return withCors(await advertiseOauth(await transport.handleRequest(request)));
}

export const POST = handle;
