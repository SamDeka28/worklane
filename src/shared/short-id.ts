const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BigInt(ALPHABET.length);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Packs a UUID into ~22 URL-safe characters; reversible with `fromShortId`. */
export function toShortId(uuid: string): string {
  if (!UUID_RE.test(uuid)) return uuid;
  let n = BigInt(`0x${uuid.replace(/-/g, "")}`);
  let out = "";
  while (n > BigInt(0)) {
    out = ALPHABET[Number(n % BASE)] + out;
    n /= BASE;
  }
  return out || "0";
}

export function fromShortId(code: string): string | null {
  if (!/^[0-9A-Za-z]{1,22}$/.test(code)) return null;
  let n = BigInt(0);
  for (const ch of code) n = n * BASE + BigInt(ALPHABET.indexOf(ch));
  const hex = n.toString(16);
  if (hex.length > 32) return null;
  const h = hex.padStart(32, "0");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const taskSharePath = (taskId: string) => `/t/${toShortId(taskId)}`;
