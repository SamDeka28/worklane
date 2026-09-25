import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { headingId } from "../registry";
import type { DocBlock } from "../types";
import { InlineText } from "./inline-text";

const CALLOUT = {
  tip: {
    icon: Lightbulb,
    label: "Tip",
    className: "border-emerald-400/20 bg-emerald-400/[0.06]",
    iconClassName: "text-emerald-300",
  },
  note: {
    icon: Info,
    label: "Note",
    className: "border-violet-400/20 bg-violet-400/[0.07]",
    iconClassName: "text-violet-300",
  },
  warning: {
    icon: AlertTriangle,
    label: "Heads up",
    className: "border-amber-400/25 bg-amber-400/[0.07]",
    iconClassName: "text-amber-300",
  },
} as const;

export function DocBlocks({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-[15px] leading-7 text-white/65">
          <InlineText text={block.text} />
        </p>
      );
    case "h2": {
      const id = headingId(block);
      return (
        <h2
          id={id}
          className="group scroll-mt-28 pt-6 font-heading text-[1.45rem] font-bold tracking-[-0.02em] text-white"
        >
          <a href={`#${id}`} className="no-underline">
            {block.text}
            <span
              className="ml-2 text-violet-300/0 transition-colors group-hover:text-violet-300/60"
              aria-hidden
            >
              #
            </span>
          </a>
        </h2>
      );
    }
    case "h3":
      return (
        <h3 className="pt-3 text-[1.05rem] font-semibold tracking-tight text-white">
          <InlineText text={block.text} />
        </h3>
      );
    case "list":
      return (
        <ul className="space-y-2.5">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-3 text-[15px] leading-7 text-white/65">
              <span
                className="mt-[0.7rem] size-1.5 shrink-0 rounded-full bg-violet-300/60"
                aria-hidden
              />
              <span>
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="relative space-y-1">
          {block.items.map((item, index) => (
            <li key={index} className="relative flex gap-4 pb-4 last:pb-0">
              {index < block.items.length - 1 ? (
                <span
                  className="absolute top-8 bottom-0 left-[0.9rem] w-px bg-white/10"
                  aria-hidden
                />
              ) : null}
              <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-xs font-semibold text-violet-200 ring-1 ring-violet-300/25">
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[15px] font-semibold leading-6 text-white">
                  <InlineText text={item.title} />
                </p>
                {item.body ? (
                  <p className="mt-1 text-[14.5px] leading-6 text-white/60">
                    <InlineText text={item.body} />
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      );
    case "callout": {
      const tone = CALLOUT[block.tone];
      const Icon = tone.icon;
      return (
        <aside className={cn("flex gap-3 rounded-2xl border px-4 py-3.5", tone.className)}>
          <Icon className={cn("mt-0.5 size-4 shrink-0", tone.iconClassName)} aria-hidden />
          <div className="min-w-0 text-[14.5px] leading-6 text-white/70">
            <p className="font-semibold text-white">{block.title ?? tone.label}</p>
            <p className="mt-0.5">
              <InlineText text={block.text} />
            </p>
          </div>
        </aside>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-white/10">
          <table className="w-full min-w-[32rem] border-collapse text-left text-[14px]">
            <thead className="bg-white/[0.04]">
              <tr>
                {block.head.map((cell) => (
                  <th
                    key={cell}
                    className="px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-white/45 uppercase"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "px-4 py-3 leading-6",
                        cellIndex === 0 ? "font-medium whitespace-nowrap text-white" : "text-white/60",
                      )}
                    >
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "keys":
      return (
        <dl className="divide-y divide-white/8 rounded-2xl ring-1 ring-white/10">
          {block.items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-[14px] text-white/65">{item.label}</dt>
              <dd className="flex shrink-0 flex-wrap justify-end gap-1">
                {item.keys.map((key) => (
                  <kbd
                    key={key}
                    className="min-w-6 rounded-md border border-white/12 border-b-white/20 bg-white/[0.06] px-1.5 py-0.5 text-center font-sans text-[12px] font-medium text-white/85"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}
