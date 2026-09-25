import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Documentation",
    template: "%s · Worklane Docs",
  },
  description:
    "Guides, how-tos, and reference for running your studio on Worklane — leads, projects, boards, finance, partners, and team access.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <main className="relative min-h-svh pt-16 sm:pt-[4.25rem]">{children}</main>;
}
