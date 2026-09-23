import { cache } from "react";
import { listClients } from "@/modules/clients/queries";
import { listProjectBoard } from "@/modules/delivery/queries";
import { chargeTitle } from "@/modules/finance/presentation";
import { loadOrgFinance } from "@/modules/finance/queries";
import { requireOrg } from "@/modules/identity/org";
import {
  canAccessModule,
  canSeeMoney,
} from "@/modules/identity/permissions";
import { loadPartnerBalances } from "@/modules/partners/queries";
import type { IsoCurrency } from "@/shared/money";
import {
  buildOpsQueue,
  type BillCandidate,
  type CollectCandidate,
  type LogCandidate,
  type OpsQueueItem,
  type SettleCandidate,
} from "@/modules/ops/queue";

function asCurrency(value: string): IsoCurrency {
  return value === "INR" ? "INR" : "USD";
}

export const loadOpsQueue = cache(async (
  orgSlug: string,
  extras?: { follows?: Parameters<typeof buildOpsQueue>[0]["follows"] },
): Promise<OpsQueueItem[]> => {
  const asOf = new Date().toISOString().slice(0, 10);
  const ctx = await requireOrg(orgSlug);
  const seeMoney = canSeeMoney(ctx.permissions);
  const seePartners = canAccessModule(ctx.permissions, "partners");

  const [finance, board, clients, balances] = await Promise.all([
    seeMoney ? loadOrgFinance(orgSlug) : Promise.resolve(null),
    listProjectBoard(orgSlug),
    listClients(orgSlug),
    seeMoney && seePartners
      ? loadPartnerBalances(orgSlug).catch(() => [])
      : Promise.resolve([]),
  ]);

  const names = new Map(clients.map((client) => [client.id, client.name]));
  const projectById = new Map(board.map((row) => [row.project.id, row]));

  const collects: CollectCandidate[] = seeMoney
    ? (finance?.charges ?? [])
        .filter((charge) => charge.status !== "void" && charge.outstandingMinor > BigInt(0))
        .map((charge) => ({
          clientId: charge.clientId,
          clientName: names.get(charge.clientId) ?? "Client",
          chargeId: charge.id,
          chargeLabel: chargeTitle(charge),
          outstandingMinor: charge.outstandingMinor,
          currency: charge.currency,
          dueOn: charge.dueOn,
          overdue: charge.overdue,
          chargedOn: charge.chargedOn,
        }))
    : [];

  const activeIds = board
    .filter((row) => row.project.status === "active" || row.project.status === "planning")
    .map((row) => row.project.id);

  let bills: BillCandidate[] = [];
  if (seeMoney && activeIds.length > 0) {
    const { data, error } = await ctx.supabase
      .from("milestones")
      .select("id, name, project_id, amount_minor, status, charge_id")
      .eq("organization_id", ctx.org.id)
      .in("project_id", activeIds)
      .is("charge_id", null);
    if (error) throw new Error(error.message);
    bills = (data ?? [])
      .filter((row) => row.amount_minor != null && Number(row.amount_minor) > 0)
      .filter((row) => row.status === "in_progress" || row.status === "completed")
      .map((row) => {
        const boardRow = projectById.get(row.project_id);
        if (!boardRow) return null;
        return {
          milestoneId: row.id,
          milestoneName: row.name,
          projectId: boardRow.project.id,
          projectName: boardRow.project.name,
          clientName: boardRow.project.clientName,
          amountMinor: BigInt(row.amount_minor),
          currency: asCurrency(boardRow.project.currency),
          status: row.status,
        } satisfies BillCandidate;
      })
      .filter((row): row is BillCandidate => row != null);
  }

  const logs: LogCandidate[] = board
    .filter((row) => row.project.status === "active" || row.project.status === "planning")
    .map((row) => ({
      projectId: row.project.id,
      projectName: row.project.name,
      clientName: row.project.clientName,
      clientId: row.project.clientId,
      billingMode: row.project.billingMode,
      loggedToday: row.lastWorkedOn === asOf,
      logCount: row.logCount,
    }));

  const settles: SettleCandidate[] =
    seeMoney && seePartners
      ? balances
          .filter((row) => row.payableMinor > BigInt(0) && row.active)
          .map((row) => ({
            partnerId: row.partnerId,
            partnerName: row.name,
            payableMinor: row.payableMinor,
            currency: row.currency,
          }))
      : [];

  return buildOpsQueue({
    orgSlug,
    asOf,
    collects,
    bills,
    logs,
    settles,
    follows: extras?.follows,
  });
});
