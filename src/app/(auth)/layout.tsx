import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-theme="dark"
      className="lane-auth relative flex min-h-dvh items-stretch justify-center overflow-hidden p-0 sm:items-center sm:p-6 lg:p-8"
    >
      <div className="lane-shell relative z-10 grid w-full max-w-[64rem] overflow-hidden rounded-none sm:rounded-[2rem] lg:min-h-[38rem] lg:grid-cols-2">
        <AuthVisualPanel />

        <section className="flex min-h-dvh flex-col bg-card sm:min-h-0">
          <header className="flex h-14 shrink-0 items-center justify-between px-5 sm:px-6 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <BrandMark size={24} priority />
              <span className="text-sm font-semibold text-foreground">Worklane</span>
            </Link>
            <Link
              href="/"
              className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              Back
            </Link>
          </header>
          <div className="flex flex-1 flex-col justify-center px-5 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div className="mx-auto w-full max-w-[22rem]">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
