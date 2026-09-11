import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-[radial-gradient(ellipse_at_top,_#eef3ff,_#f7f8fb_55%,_#f3f1ec)]">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-6">
        <BrandMark size={28} />
        <div>
          <p className="text-sm font-semibold tracking-tight">Worklane</p>
          <p className="text-xs text-muted-foreground">Shared portal</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">{children}</main>
    </div>
  );
}
