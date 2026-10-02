const DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)$/;
const MAX_IMAGE_CHARS = 700_000;

export function readSignature(formData: FormData):
  | { signatureText: string | null; signatureImage: string | null }
  | { error: string } {
  const signatureText = String(formData.get("signature_text") ?? "").trim().slice(0, 120) || null;
  const raw = String(formData.get("signature_image") ?? "").trim();
  if (!raw && !signatureText) return { error: "Add a typed, drawn, or uploaded signature" };
  if (!raw) return { signatureText, signatureImage: null };
  const match = raw.match(DATA_URL);
  if (!match) return { error: "Use a PNG or JPEG signature" };
  const body = match[2].replace(/\s/g, "");
  if (body.length > MAX_IMAGE_CHARS) return { error: "That signature image is too large" };
  return { signatureText, signatureImage: `data:image/${match[1]};base64,${body}` };
}

export function signatureIntent(signerName: string, title: string, signatureText: string | null, drawn: boolean, behalf?: string) {
  const who = behalf ? `${signerName}, on behalf of ${behalf},` : `${signerName},`;
  const adopted = drawn
    ? signatureText
      ? `the signature image I provided and the name "${signatureText}"`
      : "the signature image I provided"
    : `"${signatureText}"`;
  return `I, ${who} agree to the terms of "${title}" and adopt ${adopted} as my electronic signature.`;
}
