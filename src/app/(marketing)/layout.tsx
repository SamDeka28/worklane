import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { MarketingHeader } from "@/components/marketing/marketing-header";

const PRODUCT_LINKS = [
  { href: "#board", label: "Board" },
  { href: "#modules", label: "Product" },
  { href: "#lane", label: "How it works" },
  { href: "#faq", label: "FAQ" },
] as const;

const MODULE_LINKS = [
  { href: "#leads", label: "Leads" },
  { href: "#projects", label: "Projects" },
  { href: "#board", label: "Board" },
  { href: "#finance", label: "Finance" },
] as const;

const COMPANY_LINKS = [
  { href: "/signup", label: "Create account" },
  { href: "/login", label: "Sign in" },
] as const;

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" className="lane-marketing lane-auth min-h-svh text-foreground">
      <MarketingHeader />
      {children}
      <footer className="border-t border-white/8 px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[90rem] gap-12 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] md:gap-10">
          <div className="flex items-start gap-3">
            <BrandMark size={36} className="mt-0.5 brightness-110" />
            <div>
              <p className="text-base font-semibold tracking-tight">Worklane</p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-white/40">
                Leads, projects, board, and finance — one continuous studio lane.
              </p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/30 uppercase">
              Product
            </p>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/45 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/30 uppercase">
              Modules
            </p>
            <ul className="mt-4 space-y-2.5">
              {MODULE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/45 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/30 uppercase">
              Company
            </p>
            <ul className="mt-4 space-y-2.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/45 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-12 max-w-[90rem] text-xs text-white/22">
          © {new Date().getFullYear()} Worklane
        </p>
      </footer>
    </div>
  );
}
