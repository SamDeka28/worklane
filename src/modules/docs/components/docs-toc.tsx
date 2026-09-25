"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { DocHeading } from "../types";

export function DocsToc({ headings }: { headings: DocHeading[] }) {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -65% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-white/35 uppercase">
        On this page
      </p>
      <ul className="mt-3 space-y-1 border-l border-white/8">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={cn(
                "-ml-px block border-l py-1 pl-3 text-[13px] leading-5 transition-colors",
                active === heading.id
                  ? "border-violet-300 text-white"
                  : "border-transparent text-white/45 hover:text-white/80",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
