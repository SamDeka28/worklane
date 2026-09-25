import { ArrowRight, BookOpen, Keyboard, Rocket, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CATEGORY_ICON } from "@/modules/docs/components/category-icon";
import { DocsSearch } from "@/modules/docs/components/docs-search";
import {
  DOC_ARTICLES,
  DOC_CATEGORIES,
  DOC_KIND_LABEL,
  docSearchIndex,
  docsInCategory,
  getDocArticle,
} from "@/modules/docs/registry";

const START_HERE = [
  { slug: "quick-start", icon: Rocket, blurb: "From empty studio to first payment in ten minutes." },
  { slug: "introduction", icon: BookOpen, blurb: "The lane, the modules, and who sees what." },
  { slug: "roles-and-access", icon: ShieldCheck, blurb: "Full, Progress, Partner, or Custom — pick the right lens." },
  { slug: "keyboard-shortcuts", icon: Keyboard, blurb: "⌘K and every other shortcut worth knowing." },
] as const;

const POPULAR = [
  "convert-a-lead",
  "milestones",
  "log-work",
  "record-payments",
  "partner-splits",
  "invite-teammates",
  "credentials",
  "invoices",
];

export default function DocsHomePage() {
  const searchIndex = docSearchIndex();
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-white/8 px-5 pt-16 pb-16 sm:px-8 sm:pt-20 sm:pb-20 lg:px-12">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 55% 60% at 50% 0%, oklch(0.5 0.2 275 / 0.35), transparent 70%)",
          }}
        />
        <div className="lane-marketing-hero mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-violet-300/70 uppercase">
            Worklane documentation
          </p>
          <h1 className="mt-4 font-heading text-[clamp(2.25rem,5.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.04em] text-white">
            Learn to run your studio on the lane.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-white/50 sm:text-base">
            Step-by-step how-tos, in-depth guides, and reference for every
            module — from your first lead to settling partner payouts.
          </p>
          <div className="relative z-20 mx-auto mt-9 max-w-xl text-left">
            <DocsSearch entries={searchIndex} size="lg" />
          </div>
          <p className="mt-4 text-xs text-white/35">
            {DOC_ARTICLES.length} articles · press <kbd className="rounded border border-white/15 px-1">/</kbd> to search
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[76rem]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-white">Start here</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {START_HERE.map((item) => {
              const article = getDocArticle(item.slug);
              if (!article) return null;
              const Icon = item.icon;
              return (
                <Link
                  key={item.slug}
                  href={`/docs/${item.slug}`}
                  className="group relative overflow-hidden rounded-2xl bg-white/[0.035] p-5 ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:ring-violet-300/30"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-violet-400/12 ring-1 ring-violet-300/20">
                    <Icon className="size-5 text-violet-200" aria-hidden />
                  </span>
                  <p className="mt-4 font-semibold tracking-tight text-white">{article.title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-white/50">{item.blurb}</p>
                  <ArrowRight
                    className="absolute top-5 right-5 size-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-violet-200"
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[76rem]">
          <h2 className="font-heading text-xl font-bold tracking-tight text-white">Browse by area</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOC_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICON[category.id];
              const articles = docsInCategory(category.id);
              return (
                <div
                  key={category.id}
                  id={category.id}
                  className="scroll-mt-28 rounded-2xl bg-white/[0.025] p-6 ring-1 ring-white/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
                      <Icon className="size-4.5 text-violet-200" aria-hidden />
                    </span>
                    <div>
                      <p className="font-semibold tracking-tight text-white">{category.title}</p>
                      <p className="text-xs text-white/40">{articles.length} articles</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/50">{category.description}</p>
                  <ul className="mt-4 space-y-1 border-t border-white/8 pt-4">
                    {articles.map((article) => (
                      <li key={article.slug}>
                        <Link
                          href={`/docs/${article.slug}`}
                          className="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 -mx-2 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <span className="truncate">{article.title}</span>
                          <span className="shrink-0 text-[11px] text-white/30 group-hover:text-violet-200/70">
                            {DOC_KIND_LABEL[article.kind]}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 bg-shell px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[76rem] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-violet-300/65 uppercase">
              Popular how-tos
            </p>
            <h2 className="mt-3 font-heading text-[clamp(1.6rem,3vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              The tasks studios do every week.
            </h2>
            <p className="mt-4 max-w-sm text-[15px] leading-7 text-white/45">
              Short, exact steps using the same labels you&apos;ll see in the
              app.
            </p>
          </div>
          <ul className="divide-y divide-white/8 border-y border-white/8">
            {POPULAR.map((slug) => {
              const article = getDocArticle(slug);
              if (!article) return null;
              return (
                <li key={slug}>
                  <Link
                    href={`/docs/${slug}`}
                    className="group flex items-center justify-between gap-6 py-4"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-white group-hover:text-violet-100">
                        {article.title}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-white/40">
                        {article.summary}
                      </span>
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-violet-200"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[76rem] flex-col items-start justify-between gap-6 rounded-3xl bg-white/[0.03] p-8 ring-1 ring-white/10 sm:flex-row sm:items-center sm:p-10">
          <div>
            <p className="font-heading text-2xl font-bold tracking-tight text-white">
              Ready to try it?
            </p>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/50">
              Create a studio in under a minute and follow the quick start as
              you go.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              Start free
            </Link>
            <Link
              href="/docs/quick-start"
              className="inline-flex h-11 items-center rounded-full px-6 text-sm text-white ring-1 ring-white/15 transition hover:bg-white/8"
            >
              Read the quick start
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
