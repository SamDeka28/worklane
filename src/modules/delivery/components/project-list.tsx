import Link from "next/link";
import { AvatarMark } from "@/components/studio/chrome";
import {
  DenseCell,
  DenseListPanel,
  DenseRow,
} from "@/components/studio/index-layout";
import { Meter } from "@/components/studio/meter";
import { StatusChip } from "@/components/studio/status-chip";
import { BILLING_MODE_LABEL } from "@/modules/delivery/board";
import type { ProjectNextStep } from "@/modules/delivery/next-step";
import type { ProjectStatus } from "@/modules/delivery/types";
import { moneyLabel } from "@/modules/finance/ledger";
import { formatDay } from "@/modules/finance/presentation";

const STATUS_TONE = {
  planning: "planning",
  active: "active",
  on_hold: "on_hold",
  completed: "completed",
  cancelled: "cancelled",
} as const;

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type ProjectListCard = {
  project: {
    id: string;
    name: string;
    status: string;
    clientId: string;
    clientName: string;
    billingMode: keyof typeof BILLING_MODE_LABEL;
    dueOn: string | null;
    currency: "USD" | "INR";
  };
  money: {
    totalPriceMinor: bigint;
    outstandingMinor: bigint;
    collectedMinor: bigint;
    remainingMinor: bigint;
  };
  monthDueMinor: bigint;
  next: ProjectNextStep;
  nextHref: string;
  openTasks: number;
  unbilledMilestones: number;
  milestoneCount: number;
  logCount: number;
  lastWorkedOn: string | null;
};

export function ProjectListPanel({
  orgSlug,
  cards,
}: {
  orgSlug: string;
  canWrite?: boolean;
  cards: ProjectListCard[];
}) {
  return (
    <DenseListPanel
      columns={
        <>
          <span className="min-w-0 flex-[1.6]">Project</span>
          <span className="hidden w-44 xl:block">Collected</span>
          <span className="hidden w-28 text-right lg:block">Work</span>
          <span className="w-24 text-right sm:w-28">Due</span>
          <span className="hidden w-24 text-right md:block sm:w-28">Left</span>
        </>
      }
      footer="Click a project to open the board, milestones, and money."
    >
      {cards.map((card) => (
        <ProjectListRow key={card.project.id} orgSlug={orgSlug} card={card} />
      ))}
    </DenseListPanel>
  );
}

function ProjectListRow({
  orgSlug,
  card,
}: {
  orgSlug: string;
  card: ProjectListCard;
}) {
  const total = Number(card.money.totalPriceMinor);
  const collected = Number(card.money.collectedMinor);
  const progress = total > 0 ? Math.min(1, Math.max(0, collected / total)) : 0;
  const progressTone =
    card.money.outstandingMinor > BigInt(0)
      ? "default"
      : card.money.collectedMinor > BigInt(0)
        ? "paid"
        : "default";

  const workBits = [
    card.openTasks > 0 ? `${card.openTasks} task${card.openTasks === 1 ? "" : "s"}` : null,
    card.unbilledMilestones > 0
      ? `${card.unbilledMilestones} unbilled`
      : null,
    card.lastWorkedOn ? formatDay(card.lastWorkedOn) : null,
  ].filter(Boolean);

  return (
    <DenseRow className="gap-4 py-3.5">
      <DenseCell className="min-w-0 flex-[1.6]">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/${orgSlug}/projects/${card.project.id}`}
            className="shrink-0"
          >
            <AvatarMark name={card.project.name} size="sm" />
          </Link>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link
                href={`/${orgSlug}/projects/${card.project.id}`}
                className="truncate text-sm font-semibold tracking-tight hover:text-primary"
              >
                {card.project.name}
              </Link>
              <StatusChip tone={STATUS_TONE[card.project.status as ProjectStatus]}>
                {STATUS_LABEL[card.project.status]}
              </StatusChip>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              <Link
                href={`/${orgSlug}/clients/${card.project.clientId}`}
                className="hover:underline"
              >
                {card.project.clientName}
              </Link>
              <span className="text-border"> · </span>
              {BILLING_MODE_LABEL[card.project.billingMode]}
              {card.project.dueOn ? (
                <>
                  <span className="text-border"> · </span>
                  due {formatDay(card.project.dueOn)}
                </>
              ) : null}
            </p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground xl:hidden">
              {total > 0
                ? `${moneyLabel(card.money.collectedMinor, card.project.currency)} of ${moneyLabel(card.money.totalPriceMinor, card.project.currency)}`
                : workBits.length > 0
                  ? workBits.join(" · ")
                  : card.next.title}
            </p>
          </div>
        </div>
      </DenseCell>

      <DenseCell width="hidden w-44 xl:block">
        <div className="space-y-1.5">
          <Meter value={progress} tone={progressTone} />
          <p className="truncate text-[11px] tabular-nums text-muted-foreground">
            {total > 0 ? (
              <>
                <span className="font-medium text-foreground/80">
                  {moneyLabel(card.money.collectedMinor, card.project.currency)}
                </span>
                {" / "}
                {moneyLabel(card.money.totalPriceMinor, card.project.currency)}
              </>
            ) : (
              "No contract yet"
            )}
          </p>
        </div>
      </DenseCell>

      <DenseCell
        align="right"
        width="hidden w-28 lg:block"
        className="text-xs text-muted-foreground"
      >
        {workBits.length > 0 ? (
          <div className="space-y-0.5">
            {card.openTasks > 0 ? (
              <p>
                <span className="font-semibold tabular-nums text-foreground">
                  {card.openTasks}
                </span>{" "}
                open
              </p>
            ) : (
              <p>No open tasks</p>
            )}
            {card.unbilledMilestones > 0 ? (
              <p>
                <span className="font-semibold tabular-nums text-foreground">
                  {card.unbilledMilestones}
                </span>{" "}
                unbilled
              </p>
            ) : card.milestoneCount > 0 ? (
              <p>{card.milestoneCount} milestones</p>
            ) : null}
          </div>
        ) : (
          <p>—</p>
        )}
      </DenseCell>

      <DenseCell
        align="right"
        width="w-24 sm:w-28"
        className="text-sm font-semibold tabular-nums tracking-tight"
      >
        <p>{moneyLabel(card.money.outstandingMinor, card.project.currency)}</p>
        {card.monthDueMinor > BigInt(0) ? (
          <p className="mt-0.5 text-[11px] font-normal text-amber-800/85">
            {moneyLabel(card.monthDueMinor, card.project.currency)} this mo
          </p>
        ) : null}
      </DenseCell>

      <DenseCell
        align="right"
        width="hidden w-24 md:block sm:w-28"
        className="text-sm tabular-nums text-muted-foreground"
      >
        {moneyLabel(card.money.remainingMinor, card.project.currency)}
      </DenseCell>
    </DenseRow>
  );
}
