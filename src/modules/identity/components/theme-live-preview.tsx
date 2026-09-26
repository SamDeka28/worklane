import {
  Columns3,
  FolderKanban,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Search,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentStyle, InterfaceStyle, SurfaceStyle } from "@/shared/theme/styles";

const NAV = [
  { label: "Home", icon: LayoutDashboard },
  { section: "Sell" },
  { label: "Leads", icon: Target },
  { label: "Clients", icon: Users },
  { section: "Deliver" },
  { label: "Projects", icon: FolderKanban, active: true },
  { label: "Board", icon: Columns3 },
  { section: "Money" },
  { label: "Finance", icon: Wallet },
  { label: "Invoices", icon: ReceiptText },
] as const;

const COLUMNS = [
  {
    title: "Planning",
    dot: "bg-status-planning-fg",
    cards: [{ title: "Brand refresh", client: "Northwind", tag: "Scoping", tone: "planning", who: "AK" }],
  },
  {
    title: "Active",
    dot: "bg-status-active-fg",
    cards: [
      { title: "Checkout revamp", client: "Algebrik AI", tag: "On track", tone: "active", who: "SD" },
      { title: "Mobile app v2", client: "Helio", tag: "Due Fri", tone: "due", who: "RM" },
    ],
  },
  {
    title: "Review",
    dot: "bg-status-hold-fg",
    cards: [{ title: "Pitch deck", client: "Lumen", tag: "Waiting", tone: "hold", who: "PK" }],
  },
] as const;

const TONE: Record<string, string> = {
  planning: "bg-status-planning text-status-planning-fg",
  active: "bg-status-active text-status-active-fg",
  due: "bg-status-due text-status-due-fg",
  hold: "bg-status-hold text-status-hold-fg",
};

/** Renders with the theme's real tokens, so it avoids `dark:` utilities that follow the page theme. */
export function ThemeLivePreview({
  themeId,
  surface,
  component,
  style,
}: {
  themeId: string;
  surface: SurfaceStyle;
  component: ComponentStyle;
  style: InterfaceStyle;
}) {
  return (
    <div
      data-theme={themeId}
      data-surface={surface}
      data-shape={component}
      data-style={style}
      className="lane-app overflow-hidden rounded-2xl text-foreground shadow-lift ring-1 ring-black/10"
    >
      <div className="flex h-[27rem]">
        <aside className="hidden w-40 shrink-0 flex-col gap-0.5 border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground sm:flex">
          <div className="mb-3 flex items-center gap-2 px-1">
            <span className="lane-gradient grid size-6 place-items-center rounded-lg text-[10px] font-bold text-primary-foreground">
              W
            </span>
            <span className="truncate text-[13px] font-semibold">Your studio</span>
          </div>
          {NAV.map((item) =>
            "section" in item ? (
              <p
                key={item.section}
                className="px-2 pt-2.5 pb-1 text-[9px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
              >
                {item.section}
              </p>
            ) : (
              <span
                key={item.label}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]",
                  "active" in item
                    ? "bg-nav-active font-medium text-nav-active-foreground"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="size-3.5" aria-hidden />
                {item.label}
              </span>
            ),
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col p-2.5">
          <div data-variant="open" className="lane-work flex min-h-0 flex-1 flex-col gap-3 p-3">
          <div data-toolbar className="-mx-3 -mt-3 flex items-center gap-2 border-b px-3 pt-3 pb-2.5">
            <div className="min-w-0">
              <p className="text-[15px] font-bold tracking-tight">Projects</p>
              <p className="truncate text-[11px] text-muted-foreground">Active delivery across clients</p>
            </div>
            <span style={{ borderRadius: "var(--shape-control)" }} className="ml-auto hidden items-center gap-1.5 bg-inset px-2.5 py-1.5 text-[11px] text-muted-foreground ring-1 ring-border md:flex">
              <Search className="size-3" aria-hidden />
              Search
            </span>
            <span style={{ borderRadius: "var(--shape-control)" }} className="flex items-center gap-1 bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground shadow-glow">
              <Plus className="size-3" aria-hidden />
              New project
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-card p-3 lane-ring">
              <p className="text-[10px] text-muted-foreground">Pipeline</p>
              <p className="mt-0.5 text-[15px] font-bold tabular-nums">₹4.2L</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-inset">
                <div className="lane-gradient h-full w-2/3 rounded-full" />
              </div>
            </div>
            <div className="rounded-xl bg-card p-3 lane-ring">
              <p className="text-[10px] text-muted-foreground">Collected</p>
              <p className="mt-0.5 text-[15px] font-bold tabular-nums">₹2.8L</p>
              <span className="mt-1.5 inline-block rounded-full bg-status-paid px-1.5 py-0.5 text-[9px] font-medium text-status-paid-fg">
                +12% this month
              </span>
            </div>
            <div className="rounded-xl bg-card p-3 lane-ring">
              <p className="text-[10px] text-muted-foreground">Overdue</p>
              <p className="mt-0.5 text-[15px] font-bold tabular-nums">₹38k</p>
              <span className="mt-1.5 inline-block rounded-full bg-status-overdue px-1.5 py-0.5 text-[9px] font-medium text-status-overdue-fg">
                2 invoices
              </span>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
            {COLUMNS.map((col) => (
              <div key={col.title} className="flex min-h-0 flex-col gap-1.5 rounded-xl bg-inset/80 p-2 ring-1 ring-border/60">
                <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold">
                  <span className={cn("size-1.5 rounded-full", col.dot)} />
                  {col.title}
                  <span className="ml-auto text-muted-foreground tabular-nums">{col.cards.length}</span>
                </p>
                {col.cards.map((card) => (
                  <div key={card.title} className="rounded-lg bg-card p-2 lane-ring">
                    <p className="truncate text-[11px] font-semibold">{card.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{card.client}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", TONE[card.tone])}>
                        {card.tag}
                      </span>
                      <span className="lane-gradient grid size-5 place-items-center rounded-full text-[8px] font-bold text-primary-foreground">
                        {card.who}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}
