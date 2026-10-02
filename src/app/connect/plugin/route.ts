import { readFileSync } from "fs";
import { headers } from "next/headers";
import path from "path";
import { NextResponse } from "next/server";
import { originFromHeaders } from "@/modules/mcp/origin";
import { pluginEntries } from "@/modules/mcp/plugin-package";
import { zipFiles } from "@/modules/mcp/zip";

export const runtime = "nodejs";

export async function GET() {
  const origin = originFromHeaders(await headers()) ?? "http://localhost:3000";
  const logo = readFileSync(path.join(process.cwd(), "public/brand/worklane-email-mark.png"));
  const body = zipFiles([
    ...pluginEntries(origin).map((file) => ({ name: file.name, data: Buffer.from(file.text) })),
    { name: "assets/logo.png", data: logo },
  ]);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=\"worklane-chatgpt-plugin.zip\"",
    },
  });
}
