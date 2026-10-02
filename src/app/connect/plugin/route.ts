import { readFileSync } from "fs";
import { headers } from "next/headers";
import path from "path";
import { NextResponse } from "next/server";
import { originFromHeaders } from "@/modules/mcp/origin";
import { parseWorklaneAppId, pluginEntries, pluginPackageName } from "@/modules/mcp/plugin-package";
import { zipFiles } from "@/modules/mcp/zip";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const submitted = new URL(request.url).searchParams.get("app_id") ?? "";
  const appId = parseWorklaneAppId(submitted);
  if (!appId) {
    const back = new URL("/connect", request.url);
    back.searchParams.set("plugin", "invalid");
    if (submitted.trim()) back.searchParams.set("app_id", submitted.trim().slice(0, 240));
    return NextResponse.redirect(back);
  }
  const packageName = pluginPackageName(appId) ?? "worklane";
  const origin = originFromHeaders(await headers()) ?? "http://localhost:3000";
  const logo = readFileSync(path.join(process.cwd(), "public/brand/worklane-email-mark.png"));
  const body = zipFiles([
    ...pluginEntries(origin, appId).map((file) => ({ name: file.name, data: Buffer.from(file.text) })),
    { name: "assets/logo.png", data: logo },
  ]);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${packageName}.zip"`,
    },
  });
}
