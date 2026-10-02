import { NextResponse } from "next/server";
import { OFFLINE_SCOPE, READ_SCOPE, WRITE_SCOPE, requestOrigin } from "@/modules/mcp/origin";

export function GET(request: Request) {
  const origin = requestOrigin(request);
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/connect`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    scopes_supported: [READ_SCOPE, WRITE_SCOPE, OFFLINE_SCOPE],
  });
}
