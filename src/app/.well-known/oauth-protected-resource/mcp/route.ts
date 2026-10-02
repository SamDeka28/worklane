import { NextResponse } from "next/server";
import { protectedResourceMetadata, requestOrigin } from "@/modules/mcp/origin";

export function GET(request: Request) {
  return NextResponse.json(protectedResourceMetadata(requestOrigin(request)));
}
