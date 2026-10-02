"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SIGNATURE_FONT } from "@/modules/documents/components/signature-blocks";
import { cn } from "@/lib/utils";

type Mode = "type" | "draw" | "upload";

export function SignatureCapture({
  initialText = "",
  onReadyChange,
}: {
  initialText?: string;
  onReadyChange?: (ready: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("type");
  const [text, setText] = useState(initialText);
  const [image, setImage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const moved = useRef(false);

  const ready = mode === "type" ? Boolean(text.trim()) : Boolean(image);
  useEffect(() => {
    onReadyChange?.(ready);
  }, [onReadyChange, ready]);

  function paint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !drawing.current) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((event.clientY - rect.top) * canvas.height) / rect.height;
    ctx.lineTo(x, y);
    ctx.stroke();
    moved.current = true;
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    drawing.current = true;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((event.clientY - rect.top) * canvas.height) / rect.height;
    ctx.moveTo(x, y);
    canvas.setPointerCapture(event.pointerId);
  }

  function endDraw() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !moved.current) return;
    setImage(canvas.toDataURL("image/png"));
  }

  function clearDraw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    moved.current = false;
    setImage("");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return;
    const data = await fileToPng(file);
    setImage(data);
  }

  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-2">
      <div data-slot="segmented" className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
        {(
          [
            ["type", "Type"],
            ["draw", "Draw"],
            ["upload", "Upload"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={mode === id ? "page" : undefined}
            onClick={() => setMode(id)}
            className={cn(
              "inline-flex h-8 min-w-0 items-center justify-center rounded-full px-2 text-xs font-medium",
              mode === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "type" ? (
        <div className="grid gap-2">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type your name to sign"
            autoComplete="off"
          />
          <div className="flex h-28 items-center overflow-hidden rounded-2xl bg-white px-4 ring-1 ring-slate-200">
            <p
              className={cn("truncate text-4xl leading-none", text ? "text-slate-900" : "text-slate-300")}
              style={{ fontFamily: SIGNATURE_FONT }}
            >
              {text || "Your signature"}
            </p>
          </div>
        </div>
      ) : null}
      {mode === "draw" ? (
        <div className="grid gap-2">
          <canvas
            ref={canvasRef}
            width={520}
            height={140}
            className="h-28 w-full touch-none rounded-2xl bg-white ring-1 ring-slate-200"
            onPointerDown={startDraw}
            onPointerMove={paint}
            onPointerUp={endDraw}
            onPointerCancel={endDraw}
          />
          <button type="button" className="justify-self-start text-xs text-muted-foreground hover:text-foreground" onClick={clearDraw}>
            Clear
          </button>
        </div>
      ) : null}
      {mode === "upload" ? (
        <div className="grid gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {image ? (
            <div className="flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-white px-4 ring-1 ring-slate-200">
              <img src={image} alt="Uploaded signature" className="max-h-20 w-auto object-contain" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl bg-white text-sm text-slate-500 ring-1 ring-slate-200 hover:text-slate-900"
            >
              <span className="font-medium text-slate-900">Choose an image</span>
              <span className="text-xs">PNG or JPEG</span>
            </button>
          )}
          {image ? (
            <button
              type="button"
              className="justify-self-start text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setImage("");
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
      <input type="hidden" name="signature_text" value={mode === "type" ? text : ""} />
      <input type="hidden" name="signature_image" value={mode === "type" ? "" : image} />
    </div>
  );
}

async function fileToPng(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}
