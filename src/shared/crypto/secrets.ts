import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
export const CURRENT_KEY_VERSION = 1;

export type SealedSecret = {
  keyVersion: number;
  iv: string;
  authTag: string;
  ciphertext: string;
};

function loadKey(version: number): Buffer {
  if (version !== CURRENT_KEY_VERSION) {
    throw new Error(`No credentials encryption key for version ${version}`);
  }
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY ?? "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }
  return key;
}

export function isSecretsConfigured(): boolean {
  try {
    loadKey(CURRENT_KEY_VERSION);
    return true;
  } catch {
    return false;
  }
}

/** `context` is bound as AAD so ciphertext can't be replayed onto another row. */
export function sealSecret(plaintext: string, context: string): SealedSecret {
  const key = loadKey(CURRENT_KEY_VERSION);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    keyVersion: CURRENT_KEY_VERSION,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function openSecret(sealed: SealedSecret, context: string): string {
  const key = loadKey(sealed.keyVersion);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.iv, "base64"));
  decipher.setAAD(Buffer.from(context, "utf8"));
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
