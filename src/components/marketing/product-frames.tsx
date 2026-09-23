import { cn } from "@/lib/utils";

/** Marketing-only static frames that mirror the live Worklane chrome. */

function Shell({
  active,
  title,
  purpose,
  children,
  className,
}: {
  active: string;
  title: string;
  purpose: string;
  children: React.ReactNode;
  className?: string;
}) {
  const sections = [
    {
      label: null as string | null,
      items: [{ id: "home", label: "Home" }],
    },
    {
      label: "Sell",
      items: [
        { id: "leads", label: "Leads" },
        { id: "clients", label: "Clients" },
      ],
    },
    {
      label: "Deliver",
      items: [
        { id: "projects", label: "Projects" },
        { id: "board", label: "Board" },
        { id: "documents", label: "Documents" },
        { id: "team", label: "Team" },
      ],
    },
    {
      label: "Money",
      items: [
        { id: "finance", label: "Finance" },
        { id: "partners", label: "Partners" },
      ],
    },
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.25rem] bg-shell ring-1 ring-white/10 sm:rounded-[1.75rem]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-2 truncate text-[11px] text-white/35">
          Worklane · {title}
        </span>
      </div>
      <div className="grid min-h-[20rem] grid-cols-1 md:min-h-[26rem] md:grid-cols-[12.5rem_1fr]">
        <aside className="hidden border-r border-white/8 bg-canvas p-3 md:block">
          <div className="mb-4 flex items-center gap-2 px-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-violet-500/25 text-[10px] font-bold text-violet-200">
              W
            </span>
            <span className="truncate text-xs font-semibold text-white/80">
              Worklane Studio
            </span>
          </div>
          {sections.map((section) => (
            <div key={section.label ?? "top"} className="mb-3">
              {section.label ? (
                <p className="px-2.5 pb-1 text-[9px] font-semibold tracking-[0.14em] text-white/30 uppercase">
                  {section.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const on = item.id === active;
                  return (
                    <li key={item.id}>
                      <span
                        className={cn(
                          "block rounded-lg px-2.5 py-1.5 text-[12px]",
                          on
                            ? "bg-violet-500/25 font-medium text-violet-100 ring-1 ring-violet-400/30"
                            : "text-white/45",
                        )}
                      >
                        {item.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>
        <div className="flex min-w-0 flex-col bg-card">
          <div className="border-b border-white/8 px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold tracking-tight text-white">{title}</p>
            <p className="mt-0.5 text-[11px] text-white/40">{purpose}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  title,
  project,
  priority,
  kind,
  due,
}: {
  title: string;
  project: string;
  priority: "H" | "M" | "L";
  kind: string;
  due?: string;
}) {
  const badge =
    priority === "H"
      ? "bg-rose-600 text-white"
      : priority === "M"
        ? "bg-amber-500 text-amber-950"
        : "bg-sky-600 text-white";
  return (
    <div className="rounded-2xl bg-inset p-3 ring-1 ring-white/8">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium leading-snug text-white/90">{title}</p>
        <span
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
            badge,
          )}
        >
          {priority}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-200 ring-1 ring-violet-400/25">
          {project}
        </span>
        <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] text-white/50">
          {kind}
        </span>
        {due ? (
          <span className="text-[10px] tabular-nums text-white/35">{due}</span>
        ) : null}
      </div>
    </div>
  );
}

export function BoardProductFrame({ className }: { className?: string }) {
  const columns = [
    {
      title: "Backlog",
      cards: [
        {
          title: "Wire partner settle confirm",
          project: "Meridian",
          priority: "M" as const,
          kind: "Feature",
        },
        {
          title: "Audit invite permissions",
          project: "Retainer",
          priority: "L" as const,
          kind: "Chore",
        },
      ],
    },
    {
      title: "In progress",
      cards: [
        {
          title: "Board filters by project",
          project: "Site rebuild",
          priority: "H" as const,
          kind: "Feature",
          due: "Mar 28",
        },
        {
          title: "Milestone bill preview",
          project: "Meridian",
          priority: "M" as const,
          kind: "Task",
          due: "Mar 30",
        },
      ],
    },
    {
      title: "Review",
      cards: [
        {
          title: "Lead journey rename UX",
          project: "Retainer",
          priority: "M" as const,
          kind: "Task",
        },
      ],
    },
    {
      title: "Done",
      cards: [
        {
          title: "Dark mode default",
          project: "Site rebuild",
          priority: "L" as const,
          kind: "Chore",
        },
      ],
    },
  ];

  return (
    <Shell
      active="board"
      title="Board"
      purpose="Studio board: every open card across active projects"
      className={className}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-3 sm:p-4">
        {columns.map((col) => (
          <div
            key={col.title}
            className="flex w-[15.5rem] shrink-0 flex-col rounded-2xl bg-muted ring-1 ring-white/6"
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <p className="text-[11px] font-bold tracking-[0.08em] text-white/45 uppercase">
                {col.title}
              </p>
              <span className="rounded-md bg-shell px-2 py-0.5 text-[11px] font-bold tabular-nums text-white/50 ring-1 ring-white/8">
                {col.cards.length}
              </span>
            </div>
            <div className="space-y-2 px-2.5 pb-3">
              {col.cards.map((card) => (
                <TaskCard key={card.title} {...card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function LeadsProductFrame({ className }: { className?: string }) {
  const columns = [
    {
      title: "New",
      cards: [
        { name: "Northline", stage: "New", value: "$4,800" },
        { name: "Field & Co", stage: "New", value: "$2,100" },
      ],
    },
    {
      title: "Discovery",
      cards: [{ name: "Meridian", stage: "Discovery", value: "$1,200" }],
    },
    {
      title: "Proposal",
      cards: [
        { name: "Lumen Co", stage: "Proposal", value: "$9,400" },
        { name: "Rivermark", stage: "Proposal", value: "$3,600" },
      ],
    },
    {
      title: "Won",
      cards: [{ name: "Cove Advisors", stage: "Won", value: "$12,000" }],
    },
  ];

  return (
    <Shell
      active="leads"
      title="Leads"
      purpose="Opportunities before they become clients"
      className={className}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-3 sm:p-4">
        {columns.map((col) => (
          <div
            key={col.title}
            className="flex w-[15.5rem] shrink-0 flex-col rounded-2xl bg-muted ring-1 ring-white/6"
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <p className="text-[11px] font-bold tracking-[0.08em] text-white/45 uppercase">
                {col.title}
              </p>
              <span className="rounded-md bg-shell px-2 py-0.5 text-[11px] font-bold tabular-nums text-white/50 ring-1 ring-white/8">
                {col.cards.length}
              </span>
            </div>
            <div className="space-y-2 px-2.5 pb-3">
              {col.cards.map((card) => (
                <div
                  key={card.name}
                  className="rounded-2xl bg-inset p-3 ring-1 ring-white/8"
                >
                  <p className="text-[13px] font-medium text-white/90">{card.name}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="rounded-lg bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                      {card.stage}
                    </span>
                    <span className="text-[11px] tabular-nums text-white/40">
                      {card.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function ProjectsProductFrame({ className }: { className?: string }) {
  const rows = [
    {
      name: "Meridian brand system",
      client: "Meridian",
      status: "Active",
      next: "3 open tasks",
      tone: "active" as const,
    },
    {
      name: "Site rebuild",
      client: "Lumen Co",
      status: "Planning",
      next: "Add first milestone",
      tone: "planning" as const,
    },
    {
      name: "Retainer Q1",
      client: "Cove Advisors",
      status: "Active",
      next: "Log hours",
      tone: "active" as const,
    },
    {
      name: "Launch kit",
      client: "Rivermark",
      status: "On hold",
      next: "Resume delivery",
      tone: "hold" as const,
    },
  ];

  const statusClass = {
    active: "bg-emerald-500/15 text-emerald-200",
    planning: "bg-sky-500/15 text-sky-200",
    hold: "bg-amber-500/15 text-amber-100",
  };

  return (
    <Shell
      active="projects"
      title="Projects"
      purpose="Active delivery: log work, bill milestones, run the board"
      className={className}
    >
      <div className="space-y-2 p-3 sm:p-4">
        <div className="flex gap-2 px-1 pb-2 text-[11px] font-medium text-white/35">
          <span className="min-w-0 flex-1">Project</span>
          <span className="w-24 text-right">Status</span>
          <span className="hidden w-32 text-right sm:block">Next</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.name}
            className="flex items-center gap-3 rounded-2xl bg-inset px-3.5 py-3 ring-1 ring-white/8"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white/90">
                {row.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-white/40">{row.client}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold",
                statusClass[row.tone],
              )}
            >
              {row.status}
            </span>
            <span className="hidden w-32 shrink-0 truncate text-right text-[11px] text-white/45 sm:block">
              {row.next}
            </span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function DocumentsProductFrame({ className }: { className?: string }) {
  const rows = [
    {
      title: "Meridian proposal",
      kind: "Proposal",
      status: "Accepted",
      client: "Meridian",
    },
    {
      title: "Lumen SOW",
      kind: "SOW",
      status: "Draft",
      client: "Lumen Co",
    },
    {
      title: "Cove retainer summary",
      kind: "Proposal",
      status: "Sent",
      client: "Cove Advisors",
    },
    {
      title: "Rivermark kickoff brief",
      kind: "SOW",
      status: "Draft",
      client: "Rivermark",
    },
  ];

  return (
    <Shell
      active="documents"
      title="Documents"
      purpose="Proposals and SOWs for clients and projects"
      className={className}
    >
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {["All", "Proposals", "SOWs"].map((tab, i) => (
            <span
              key={tab}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px] font-medium",
                i === 0
                  ? "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/30"
                  : "bg-white/4 text-white/40",
              )}
            >
              {tab}
            </span>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl ring-1 ring-white/8">
          <div className="flex border-b border-white/8 bg-muted px-4 py-2 text-[11px] font-medium text-white/35">
            <span className="min-w-0 flex-1">Document</span>
            <span className="w-20 text-right">Kind</span>
            <span className="w-24 text-right">Status</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.title}
              className="flex items-center border-b border-white/6 px-4 py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white/90">
                  {row.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-white/40">{row.client}</p>
              </div>
              <span className="w-20 text-right text-[11px] text-white/50">{row.kind}</span>
              <span className="w-24 text-right">
                <span
                  className={cn(
                    "inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold",
                    row.status === "Accepted"
                      ? "bg-emerald-500/15 text-emerald-200"
                      : row.status === "Sent"
                        ? "bg-sky-500/15 text-sky-200"
                        : "bg-white/8 text-white/55",
                  )}
                >
                  {row.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function FinanceProductFrame({ className }: { className?: string }) {
  const rows = [
    { name: "Meridian", due: "$3,400.00", status: "Due" },
    { name: "Lumen Co", due: "$1,850.00", status: "Overdue" },
    { name: "Cove Advisors", due: "$620.00", status: "Partial" },
  ];

  return (
    <Shell
      active="finance"
      title="Finance"
      purpose="Get paid: bill work, record what clients send"
      className={className}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {["Collect", "To bill", "Receipts", "Overview"].map((tab, i) => (
            <span
              key={tab}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px] font-medium",
                i === 0
                  ? "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/30"
                  : "bg-white/4 text-white/40",
              )}
            >
              {tab}
            </span>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Outstanding", value: "$5,870" },
            { label: "Overdue", value: "$1,850" },
            { label: "This month", value: "$2,400" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-inset px-4 py-3 ring-1 ring-white/8"
            >
              <p className="text-[11px] text-white/40">{stat.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl ring-1 ring-white/8">
          <div className="flex border-b border-white/8 bg-muted px-4 py-2 text-[11px] font-medium text-white/35">
            <span className="flex-1">Client</span>
            <span className="w-24 text-right">Status</span>
            <span className="w-24 text-right">Due</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.name}
              className="flex items-center border-b border-white/6 px-4 py-3 last:border-0"
            >
              <span className="flex-1 text-[13px] font-medium text-white/85">
                {row.name}
              </span>
              <span className="w-24 text-right">
                <span
                  className={cn(
                    "inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold",
                    row.status === "Overdue"
                      ? "bg-rose-500/15 text-rose-200"
                      : row.status === "Partial"
                        ? "bg-amber-500/15 text-amber-100"
                        : "bg-sky-500/15 text-sky-200",
                  )}
                >
                  {row.status}
                </span>
              </span>
              <span className="w-24 text-right text-[13px] font-medium tabular-nums text-white/80">
                {row.due}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function PartnersProductFrame({ className }: { className?: string }) {
  const rows = [
    { name: "Jordan Lee", earned: "$4,200", settled: "$2,800", payable: "$1,400" },
    { name: "Alex Rivera", earned: "$2,100", settled: "$2,100", payable: "$0" },
    { name: "Referral", earned: "$900", settled: "$400", payable: "$500" },
  ];

  return (
    <Shell
      active="partners"
      title="Partners"
      purpose="What partners earned versus settled"
      className={className}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-inset px-4 py-3 ring-1 ring-white/8">
            <p className="text-[11px] text-white/40">Partner payable</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">$1,900</p>
          </div>
          <div className="rounded-2xl bg-inset px-4 py-3 ring-1 ring-white/8">
            <p className="text-[11px] text-white/40">Settled this month</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">$5,300</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl ring-1 ring-white/8">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-2 border-b border-white/8 bg-muted px-4 py-2 text-[11px] font-medium text-white/35">
            <span>Partner</span>
            <span className="text-right">Earned</span>
            <span className="text-right">Settled</span>
            <span className="text-right">Payable</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-2 border-b border-white/6 px-4 py-3 text-[13px] last:border-0"
            >
              <span className="truncate font-medium text-white/85">{row.name}</span>
              <span className="text-right tabular-nums text-white/55">{row.earned}</span>
              <span className="text-right tabular-nums text-white/55">{row.settled}</span>
              <span className="text-right font-medium tabular-nums text-white">
                {row.payable}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
