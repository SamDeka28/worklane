import { ArrowLeft, ArrowRight, ChevronRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_ICON } from "@/modules/docs/components/category-icon";
import { DocBlocks } from "@/modules/docs/components/doc-blocks";
import { DocsMobileNav } from "@/modules/docs/components/docs-mobile-nav";
import { DocsNav } from "@/modules/docs/components/docs-nav";
import { DocsSearch } from "@/modules/docs/components/docs-search";
import { DocsToc } from "@/modules/docs/components/docs-toc";
import {
  DOC_ARTICLES,
  DOC_KIND_LABEL,
  docHeadings,
  docNavSections,
  docNeighbours,
  docSearchIndex,
  getDocArticle,
  getDocCategory,
  readingMinutes,
} from "@/modules/docs/registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/docs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = getDocArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    openGraph: { title: article.title, description: article.summary, type: "article" },
  };
}

export default async function DocArticlePage({ params }: PageProps<"/docs/[slug]">) {
  const { slug } = await params;
  const article = getDocArticle(slug);
  if (!article) notFound();

  const category = getDocCategory(article.category);
  const CategoryIcon = CATEGORY_ICON[category.id];
  const headings = docHeadings(article);
  const sections = docNavSections();
  const searchIndex = docSearchIndex();
  const { prev, next } = docNeighbours(article.slug);
  const related = (article.related ?? [])
    .map((relatedSlug) => getDocArticle(relatedSlug))
    .filter((item) => item !== undefined);

  return (
    <div className="mx-auto max-w-[90rem] px-5 sm:px-8 lg:px-12">
      <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[15.5rem_minmax(0,1fr)_13rem]">
        <aside className="hidden lg:block">
          <div
            data-docs-scroll
            className="sticky top-[4.25rem] h-[calc(100svh-4.25rem)] overflow-y-auto overscroll-contain py-8 pr-2 [scrollbar-width:thin]"
          >
            <DocsSearch entries={searchIndex} />
            <div className="mt-7">
              <DocsNav sections={sections} />
            </div>
          </div>
        </aside>

        <article className="min-w-0 py-8 lg:py-10">
          <div className="space-y-3 lg:hidden">
            <DocsSearch entries={searchIndex} autoFocusShortcut={false} />
            <DocsMobileNav sections={sections} current={article.title} />
          </div>

          <nav
            aria-label="Breadcrumb"
            className="mt-6 flex flex-wrap items-center gap-1.5 text-[13px] text-white/40 lg:mt-0"
          >
            <Link href="/docs" className="transition-colors hover:text-white">
              Docs
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={`/docs#${category.id}`} className="transition-colors hover:text-white">
              {category.title}
            </Link>
          </nav>

          <header className="mt-4 max-w-3xl">
            <h1 className="font-heading text-[clamp(1.9rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.035em] text-white">
              {article.title}
            </h1>
            <p className="mt-4 text-[17px] leading-7 text-white/55">{article.summary}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/45">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 ring-1 ring-white/10">
                <CategoryIcon className="size-3.5 text-violet-300/70" aria-hidden />
                {category.title}
              </span>
              <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-violet-200 ring-1 ring-violet-300/20">
                {DOC_KIND_LABEL[article.kind]}
              </span>
              <span className="inline-flex items-center gap-1.5 px-1">
                <Clock className="size-3.5" aria-hidden />
                {readingMinutes(article)} min read
              </span>
            </div>
          </header>

          <div className="mt-10 max-w-3xl border-t border-white/8 pt-8">
            <DocBlocks blocks={article.blocks} />
          </div>

          {related.length > 0 ? (
            <section className="mt-14 max-w-3xl">
              <h2 className="text-[11px] font-semibold tracking-[0.16em] text-white/35 uppercase">
                Related articles
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/docs/${item.slug}`}
                    className="group rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:ring-violet-300/25"
                  >
                    <p className="text-sm font-medium text-white group-hover:text-violet-100">
                      {item.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-white/45">
                      {item.summary}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <nav
            aria-label="Previous and next"
            className="mt-12 grid max-w-3xl gap-3 border-t border-white/8 pt-8 sm:grid-cols-2"
          >
            {prev ? (
              <Link
                href={`/docs/${prev.slug}`}
                className="group rounded-xl p-4 ring-1 ring-white/10 transition hover:bg-white/[0.04]"
              >
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" aria-hidden />
                  Previous
                </span>
                <span className="mt-1 block text-sm font-medium text-white">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/docs/${next.slug}`}
                className="group rounded-xl p-4 text-right ring-1 ring-white/10 transition hover:bg-white/[0.04]"
              >
                <span className="flex items-center justify-end gap-1.5 text-xs text-white/40">
                  Next
                  <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="mt-1 block text-sm font-medium text-white">{next.title}</span>
              </Link>
            ) : null}
          </nav>

          <div className="mt-10 flex max-w-3xl flex-col items-start justify-between gap-4 rounded-2xl bg-violet-400/[0.06] p-5 ring-1 ring-violet-300/15 sm:flex-row sm:items-center">
            <p className="text-sm text-white/65">
              Try it in your own studio — it&apos;s free to start.
            </p>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              Create account
            </Link>
          </div>
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-[4.25rem] py-10">
            <DocsToc headings={headings} />
          </div>
        </aside>
      </div>
    </div>
  );
}
