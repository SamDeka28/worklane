import { NextResponse } from "next/server";
import { originFromHeaders } from "@/modules/mcp/origin";
import { pluginEntries } from "@/modules/mcp/plugin-package";
import { zipTextFiles } from "@/modules/mcp/zip";
import { headers } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  const origin = originFromHeaders(await headers()) ?? "http://localhost:3000";
  const body = zipTextFiles(pluginEntries(origin));
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=\"worklane-chatgpt-plugin.zip\"",
    },
  });
}
