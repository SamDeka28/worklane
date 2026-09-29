"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmailAttachmentPayload } from "@/modules/emails/types";

export type { EmailAttachmentPayload } from "@/modules/emails/types";
const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function encode(file: File): Promise<EmailAttachmentPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve({ filename: file.name, contentBase64: result.slice(result.indexOf(",") + 1), contentType: file.type || "application/octet-stream" });
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function EmailAttachments({ value, onChange, disabled = false }: {
  value: EmailAttachmentPayload[];
  onChange: (value: EmailAttachmentPayload[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  async function add(files: FileList | null) {
    if (!files?.length) return;
    const next = [...files];
    if (value.length + next.length > MAX_FILES) { setError(`Attach up to ${MAX_FILES} files.`); if (input.current) input.current.value = ""; return; }
    const large = next.find((file) => file.size > MAX_FILE_BYTES);
    if (large) { setError(`${large.name} is larger than 5 MB.`); if (input.current) input.current.value = ""; return; }
    try {
      const encoded = await Promise.all(next.map(encode));
      onChange([...value, ...encoded]);
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not read attachment."); }
    if (input.current) input.current.value = "";
  }
  return <div className="grid gap-2">
    <input ref={input} type="file" multiple className="sr-only" onChange={(event) => void add(event.target.files)} disabled={disabled} />
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={disabled || value.length >= MAX_FILES}>
        <Paperclip data-icon="inline-start" /> Attach files
      </Button>
      <span className="text-xs text-muted-foreground">Up to 5 files, 5 MB each</span>
    </div>
    {value.map((file, index) => <div key={`${file.filename}-${index}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
      <span className="truncate">{file.filename}</span>
      <button type="button" aria-label={`Remove ${file.filename}`} disabled={disabled} onClick={() => onChange(value.filter((_, i) => i !== index))} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
    </div>)}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </div>;
}
