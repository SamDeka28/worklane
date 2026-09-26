import type { ReactNode } from "react";

export default function LeadIntakeLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="light" className="min-h-svh bg-[#f3f4f6] text-slate-900">
      {children}
    </div>
  );
}
