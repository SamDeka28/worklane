"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#board", label: "Board" },
  { href: "#modules", label: "Product" },
  { href: "#lane", label: "How it works" },
  { href: "#faq", label: "FAQ" },
] as const;

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-b border-white/8 bg-canvas/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-4 px-5 sm:h-[4.25rem] sm:px-8 lg:px-12">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <BrandMark size={34} priority className="brightness-110" />
          <span className="text-[15px] font-semibold tracking-tight">Worklane</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-white/55 transition-colors hover:bg-white/6 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-white/70 hover:bg-white/8 hover:text-white sm:inline-flex"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Sign in
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:brightness-110"
            nativeButton={false}
            render={<Link href="/signup" />}
          >
            Get started
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/70 hover:bg-white/8 hover:text-white lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-4" />
                </Button>
              }
            />
            <SheetContent
              side="right"
              className="border-white/10 bg-[#0A0E1C] text-white data-[side=right]:w-[min(100%,20rem)] data-[side=right]:sm:max-w-none"
            >
              <SheetHeader className="border-b border-white/8 px-2 pb-4">
                <SheetTitle className="flex items-center gap-2.5 text-white">
                  <BrandMark size={28} className="brightness-110" />
                  Worklane
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-1 flex-col gap-1 px-2 pt-2">
                {LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-xl px-3 py-3 text-[15px] font-medium text-white/70 transition-colors hover:bg-white/6 hover:text-white"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 border-t border-white/8 p-4">
                <Button
                  variant="outline"
                  className="w-full border-white/15 bg-transparent text-white hover:bg-white/8 hover:text-white"
                  nativeButton={false}
                  render={<Link href="/login" onClick={() => setOpen(false)} />}
                >
                  Sign in
                </Button>
                <Button
                  className="w-full bg-primary text-primary-foreground hover:brightness-110"
                  nativeButton={false}
                  render={<Link href="/signup" onClick={() => setOpen(false)} />}
                >
                  Get started
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
