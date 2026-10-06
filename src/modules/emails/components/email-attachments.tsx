"use client";

import { useState } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailAttachmentPayload } from "@/modules/emails/types";

export type { EmailAttachmentPayload } from "@/modules/emails/types";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function encode(file: File): Promise<EmailAttachmentPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve({
        filename: file.name,
        contentBase64: result.slice(result.indexOf(",") + 1),
        contentType: file.type || "application/octet-stream",
      });
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function EmailAttachments({
  value,
  onChange,
  disabled = false,
}: {
  value: EmailAttachmentPayload[];
  onChange: (value: EmailAttachmentPayload[]) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const full = value.length >= MAX_FILES;
  const locked = disabled || full;

  async function add(files: File[]) {
    if (files.length === 0) return;
    if (value.length + files.length > MAX_FILES) {
      setError(`Attach up to ${MAX_FILES} files.`);
      return;
    }
    const large = files.find((file) => file.size > MAX_FILE_BYTES);
    if (large) {
      setError(`${large.name} is larger than 5 MB.`);
      return;
    }
    try {
      const encoded = await Promise.all(files.map(encode));
      onChange([...value, ...encoded]);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not read attachment.");
    }
  }

  return (
    <div className="grid gap-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((file, index) => (
            <li
              key={`${file.filename}-${index}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1 text-xs"
            >
              <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{file.filename}</span>
              <button
                type="button"
                aria-label={`Remove ${file.filename}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((_, item) => item !== index))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label
        onDragOver={(event) => {
          if (locked) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (locked) return;
          void add(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dotted text-center transition-colors",
          value.length > 0 ? "px-4 py-3.5" : "px-4 py-7",
          dragging
            ? "border-primary bg-primary/15"
            : "border-foreground/35 bg-muted/25 hover:border-foreground/55 hover:bg-muted/40",
          locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <span
          className={cn(
            "flex items-center gap-2 text-sm",
            dragging ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <Upload className="size-4" aria-hidden />
          {dragging ? (
            "Drop to attach"
          ) : full ? (
            "5 files attached"
          ) : (
            <span>
              Drop files or <span className="font-medium text-foreground">browse</span>
            </span>
          )}
        </span>
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground/80">Up to 5 files, 5 MB each</span>
        ) : null}
        <input
          type="file"
          multiple
          className="sr-only"
          disabled={locked}
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            event.target.value = "";
            void add(picked);
          }}
        />
      </label>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
