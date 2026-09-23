import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="lane-auth flex min-h-svh flex-col">
      <header className="flex h-20 items-center justify-between border-b px-6 md:px-10">
        <div className="flex items-center gap-3.5">
          <BrandMark size={48} priority />
          <span className="text-xl font-medium tracking-tight">Worklane</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button nativeButton={false} render={<Link href="/signup" />}>
            Create account
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Studio operating system
        </p>
        <h1 className="font-display mt-4 max-w-2xl text-4xl leading-[1.1] tracking-tight md:text-6xl">
          From first conversation to final payment.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
          Clients, charges, and what is actually outstanding — without a spreadsheet remaining column.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/onboarding" />}>
            Enter Worklane
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/signup" />}>
            Create account
          </Button>
        </div>
      </main>
    </div>
  );
}
