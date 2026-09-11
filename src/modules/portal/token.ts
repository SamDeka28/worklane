import { createHash, randomBytes } from "node:crypto";

export function hashShareToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}
