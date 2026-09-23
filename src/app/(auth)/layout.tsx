import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lane-auth relative flex min-h-svh items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="lane-shell relative z-10 grid w-full max-w-[64rem] overflow-hidden lg:min-h-[38rem] lg:grid-cols-2">
        <AuthVisualPanel />

        <section className="flex flex-col bg-card">
          <header className="flex h-14 items-center justify-between px-6 lg:hidden">
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
          <div className="flex flex-1 flex-col justify-center px-7 py-10 sm:px-10 lg:px-12 lg:py-12">
            <div className="mx-auto w-full max-w-[22rem]">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
