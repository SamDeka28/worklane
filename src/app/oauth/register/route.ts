import { NextResponse } from "next/server";
import { registerOauthClient } from "@/modules/mcp/oauth";

export async function POST(request: Request) {
  let body: {
    client_name?: string;
    redirect_uris?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata" }, { status: 400 });
  }
  try {
    const client = await registerOauthClient({
      clientName: String(body.client_name ?? "Assistant"),
      redirectUris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
    });
    return NextResponse.json(
      {
        client_id: client.clientId,
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_client_metadata",
        error_description: error instanceof Error ? error.message : "Could not register",
      },
      { status: 400 },
    );
  }
}
