"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { DocCategoryId } from "../types";
import { CATEGORY_ICON } from "./category-icon";

export type DocsNavSection = {
  id: DocCategoryId;
  title: string;
  articles: { slug: string; title: string }[];
};

export function DocsNav({
  sections,
  onNavigate,
}: {
  sections: DocsNavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    const scroller = nav?.closest<HTMLElement>("[data-docs-scroll]");
    if (!active || !scroller) return;
    const offset =
      active.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (offset < 0 || offset > scroller.clientHeight - 48) {
      scroller.scrollTop += offset - scroller.clientHeight / 3;
    }
  }, [pathname]);

  return (
    <nav ref={navRef} aria-label="Documentation" className="space-y-7">
      <Link
        href="/docs"
        onClick={onNavigate}
        className={cn(
          "block rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors",
          pathname === "/docs"
            ? "bg-violet-400/12 text-white"
            : "text-white/55 hover:bg-white/5 hover:text-white",
        )}
      >
        Documentation home
      </Link>
      {sections.map((section) => {
        const Icon = CATEGORY_ICON[section.id];
        return (
          <div key={section.id}>
            <p className="flex items-center gap-2 px-2.5 text-[11px] font-semibold tracking-[0.16em] text-white/35 uppercase">
              <Icon className="size-3.5 text-violet-300/60" aria-hidden />
              {section.title}
            </p>
            <ul className="mt-2 space-y-0.5 border-l border-white/8 pl-2 ml-[1.1rem]">
              {section.articles.map((article) => {
                const href = `/docs/${article.slug}`;
                const active = pathname === href;
                return (
                  <li key={article.slug}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative block rounded-lg px-2.5 py-1.5 text-[13.5px] leading-5 transition-colors",
                        active
                          ? "bg-violet-400/12 font-medium text-white before:absolute before:top-1.5 before:bottom-1.5 before:-left-[0.6rem] before:w-px before:bg-violet-300"
                          : "text-white/50 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {article.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
