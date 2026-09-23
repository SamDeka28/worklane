import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex min-h-svh flex-col bg-background">
        <header className="flex h-24 items-center px-8 md:px-12">
          <Link href="/" className="flex items-center gap-3.5">
            <BrandMark size={52} priority />
            <span className="text-xl font-medium tracking-tight">Worklane</span>
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-8 py-10 md:px-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
      <aside className="relative hidden overflow-hidden bg-[#070A16] lg:block">
        <Image
          src="/brand/worklane-auth-lane.webp"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#070A16] via-[#070A16]/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="font-display max-w-md text-4xl leading-tight tracking-tight text-white">
            From first conversation to final payment.
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
            Clients, charges, and what is actually outstanding — without a spreadsheet remaining column.
          </p>
        </div>
      </aside>
    </div>
  );
}
