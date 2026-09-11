import { SoftCard } from "@/components/studio/chrome";
import { StatusChip } from "@/components/studio/status-chip";
import { loadPortalByToken } from "@/modules/portal/queries";
import { formatMoney } from "@/shared/money";
import { notFound } from "next/navigation";

export default async function PortalTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await loadPortalByToken(token);
  if (!view) notFound();

  const title =
    view.clientName ?? view.partnerName ?? view.grant.label ?? "Shared workspace";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs tracking-wide text-muted-foreground uppercase">
          {view.orgName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only share. Internal notes and partner splits are never shown here.
        </p>
      </div>

      {view.invoices.length > 0 ? (
        <SoftCard className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <p className="text-sm font-semibold">Invoices</p>
          </div>
          <ul className="divide-y divide-border/60">
            {view.invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">{invoice.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.issuedOn ? `Issued ${invoice.issuedOn}` : "Draft"}
                    {invoice.dueOn ? ` · Due ${invoice.dueOn}` : ""}
                  </p>
                </div>
                <StatusChip
                  tone={
                    invoice.status === "paid"
                      ? "paid"
                      : invoice.status === "overdue"
                        ? "overdue"
                        : "due"
                  }
                >
                  {invoice.status.replaceAll("_", " ")}
                </StatusChip>
                <span className="tabular-nums">
                  {formatMoney({
                    amountMinor: invoice.totalMinor,
                    currency: invoice.currency,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </SoftCard>
      ) : null}

      {view.milestones.length > 0 ? (
        <SoftCard className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <p className="text-sm font-semibold">Milestones</p>
          </div>
          <ul className="divide-y divide-border/60">
            {view.milestones.map((milestone) => (
              <li
                key={milestone.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{milestone.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {milestone.projectName}
                    {milestone.dueOn ? ` · due ${milestone.dueOn}` : ""}
                  </p>
                </div>
                <StatusChip>{milestone.status.replaceAll("_", " ")}</StatusChip>
              </li>
            ))}
          </ul>
        </SoftCard>
      ) : null}

      {view.documents.length > 0 ? (
        <SoftCard className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <p className="text-sm font-semibold">Documents</p>
          </div>
          <ul className="divide-y divide-border/60">
            {view.documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.kind} · {doc.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SoftCard>
      ) : null}

      {view.files.length > 0 ? (
        <SoftCard className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <p className="text-sm font-semibold">Files</p>
          </div>
          <ul className="divide-y divide-border/60">
            {view.files.map((file) => (
              <li key={file.id} className="px-5 py-3 text-sm">
                {file.name}
              </li>
            ))}
          </ul>
        </SoftCard>
      ) : null}

      {view.earnings ? (
        <SoftCard className="p-5">
          <p className="mb-3 text-sm font-semibold">Your earnings</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Earned</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatMoney({
                  amountMinor: view.earnings.earnedMinor,
                  currency: view.earnings.currency,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Settled</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatMoney({
                  amountMinor: view.earnings.settledMinor,
                  currency: view.earnings.currency,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payable</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatMoney({
                  amountMinor:
                    view.earnings.earnedMinor - view.earnings.settledMinor,
                  currency: view.earnings.currency,
                })}
              </p>
            </div>
          </div>
        </SoftCard>
      ) : null}

      {view.invoices.length === 0 &&
      view.milestones.length === 0 &&
      view.documents.length === 0 &&
      view.files.length === 0 &&
      !view.earnings ? (
        <SoftCard className="p-8 text-center text-sm text-muted-foreground">
          Nothing exposed on this share yet.
        </SoftCard>
      ) : null}
    </div>
  );
}
