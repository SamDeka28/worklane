import Link from "next/link";
import type { ReactNode } from "react";

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

export function InlineText({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => renderPart(part, index))}
    </>
  );
}

function renderPart(part: string, key: number): ReactNode {
  if (part.startsWith("**") && part.endsWith("**")) {
    return (
      <strong key={key} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    );
  }
  if (part.startsWith("`") && part.endsWith("`")) {
    return (
      <code
        key={key}
        className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-[0.85em] text-violet-200"
      >
        {part.slice(1, -1)}
      </code>
    );
  }
  const link = LINK.exec(part);
  if (link) {
    const [, label, href] = link;
    const className =
      "font-medium text-violet-300 underline decoration-violet-300/30 underline-offset-4 transition-colors hover:text-violet-200 hover:decoration-violet-200";
    if (href.startsWith("/")) {
      return (
        <Link key={key} href={href} className={className}>
          {label}
        </Link>
      );
    }
    return (
      <a key={key} href={href} className={className} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }
  return part;
}
