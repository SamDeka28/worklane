"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    title: "From first conversation to final payment.",
    body: "Leads, board, and finance in one continuous studio lane.",
  },
  {
    title: "Studio Board across every active project.",
    body: "Open cards roll up into one kanban — priority, kind, and due date stay with the work.",
  },
  {
    title: "Money that stays attached to delivery.",
    body: "Bill milestones, collect what’s due, and keep Progress teammates off the ledger.",
  },
] as const;

export function AuthVisualPanel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, []);

  const slide = SLIDES[index]!;

  return (
    <aside className="relative hidden min-h-[22rem] overflow-hidden bg-shell lg:block">
      <Image
        src="/brand/worklane-hero-mesh.webp"
        alt=""
        fill
        priority
        sizes="50vw"
        className="object-cover object-[70%_40%]"
      />
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklch, var(--canvas) 40%, transparent) 0%, transparent 35%, color-mix(in oklch, var(--canvas) 92%, transparent) 100%), radial-gradient(ellipse 70% 50% at 80% 10%, color-mix(in oklch, var(--lane-violet) 40%, transparent), transparent 70%)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col p-8 xl:p-10">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark size={28} priority className="brightness-110" />
            <span className="text-[15px] font-semibold tracking-tight text-white">
              Worklane
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white/85 ring-1 ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white"
          >
            Back to website
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-auto max-w-sm pb-2">
          <div key={index} className="lane-mkt-rise">
            <p className="font-heading text-[clamp(1.75rem,2.8vw,2.35rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white">
              {slide.title}
            </p>
            <p className="mt-3 text-[14px] leading-6 text-white/55">{slide.body}</p>
          </div>

          <div className="mt-8 flex gap-1.5" role="tablist" aria-label="Highlights">
            {SLIDES.map((item, i) => (
              <button
                key={item.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}`}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === index
                    ? "w-6 bg-white"
                    : "w-6 bg-white/30 hover:bg-white/50",
                )}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
