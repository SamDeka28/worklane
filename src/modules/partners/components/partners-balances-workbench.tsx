"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { Workbench } from "@/components/studio/composer";
import { AvatarMark, SoftCard } from "@/components/studio/chrome";
import {
  DenseCell,
  DenseListPanel,
  DenseRow,
} from "@/components/studio/index-layout";
import { StatusChip } from "@/components/studio/status-chip";
import { moneyLabel } from "@/modules/finance/ledger";
import {
  CreatePartnerDialog,
  EditPartnerDialog,
  RecordSettlementDialog,
} from "@/modules/partners/components/partner-forms";
import type { PartnerKind, PartnerRecord } from "@/modules/partners/types";
import {
  InvitePartnerLoginButton,
  ResendInviteButton,
  RevokeInviteButton,
} from "@/modules/team/components/invite-forms";
import type { OrgInvitation } from "@/modules/team/types";
import { formatMoney } from "@/shared/money";
import type { IsoCurrency } from "@/shared/money";

export type PartnerBalanceRow = {
  partnerId: string;
  name: string;
  kind: PartnerKind;
  currency: IsoCurrency;
  earnedMinor: string;
  settledMinor: string;
  payableMinor: string;
};

type LoginStatus = "active" | "pending" | "expired" | "none";

function loginStatusFor(
  partner: PartnerRecord | undefined,
  invite: OrgInvitation | undefined,
): LoginStatus {
  if (partner?.userId) return "active";
  if (!invite) return "none";
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return "expired";
  }
  return "pending";
}

function statusChip(status: LoginStatus) {
  switch (status) {
    case "active":
      return <StatusChip tone="paid">Logged in</StatusChip>;
    case "pending":
      return <StatusChip tone="planning">Invite sent</StatusChip>;
    case "expired":
      return <StatusChip tone="overdue">Invite expired</StatusChip>;
    default:
      return <StatusChip tone="cancelled">Not invited</StatusChip>;
  }
}

function accessCopy(status: LoginStatus, hasEmail: boolean) {
  switch (status) {
    case "active":
      return "They can sign in to this studio.";
    case "pending":
      return "Waiting for them to accept the invite.";
    case "expired":
      return "The invite link expired — send a new one.";
    default:
      return hasEmail
        ? "No login yet — send an invite so they can sign in."
        : "Add an email first, then invite them to log in.";
  }
}

function findInvite(
  partner: PartnerRecord | undefined,
  invites: OrgInvitation[],
): OrgInvitation | undefined {
  if (!partner) return undefined;
  return invites.find(
    (invite) =>
      invite.partnerId === partner.id ||
      (partner.email &&
        invite.email.toLowerCase() === partner.email.toLowerCase()),
  );
}

export function PartnersBalancesWorkbench({
  orgSlug,
  balances,
  partners,
  pendingInvites,
  projectsByPartnerId,
  canWrite,
  canInvite,
  initialPartnerId,
}: {
  orgSlug: string;
  balances: PartnerBalanceRow[];
  partners: PartnerRecord[];
  pendingInvites: OrgInvitation[];
  projectsByPartnerId: Record<string, { id: string; name: string }[]>;
  canWrite: boolean;
  canInvite: boolean;
  initialPartnerId?: string;
}) {
  const partnersById = useMemo(
    () => new Map(partners.map((partner) => [partner.id, partner])),
    [partners],
  );

  const defaultId =
    initialPartnerId && balances.some((row) => row.partnerId === initialPartnerId)
      ? initialPartnerId
      : balances.find((row) => BigInt(row.payableMinor) > BigInt(0))?.partnerId ??
        balances[0]?.partnerId;

  const [selectedId, setSelectedId] = useState<string | undefined>(defaultId);

  const selected = balances.find((row) => row.partnerId === selectedId) ?? balances[0];
  const selectedPartner = selected
    ? partnersById.get(selected.partnerId)
    : undefined;
  const selectedInvite = findInvite(selectedPartner, pendingInvites);
  const selectedStatus = loginStatusFor(selectedPartner, selectedInvite);
  const selectedProjects = selectedPartner
    ? (projectsByPartnerId[selectedPartner.id] ?? [])
    : [];
  const selectedPayable = selected ? BigInt(selected.payableMinor) : BigInt(0);

  return (
    <Workbench className="min-h-0 flex-1 flex-col gap-3 md:flex-row">
      <DenseListPanel
        className="md:min-w-0 md:flex-1"
        columns={
          <>
            <span className="min-w-0 flex-1">Partner</span>
            <span className="hidden w-28 text-right sm:block">Earned</span>
            <span className="w-28 text-right">Payable</span>
            <span className="w-20 text-right"> </span>
          </>
        }
        footer="Select a partner for login access and settlement. Settle from the row when payable."
      >
        {balances.map((row) => {
          const partner = partnersById.get(row.partnerId);
          const invite = findInvite(partner, pendingInvites);
          const status = loginStatusFor(partner, invite);
          const active = selected?.partnerId === row.partnerId;
          const payable = BigInt(row.payableMinor);

          return (
            <DenseRow
              key={row.partnerId}
              className={
                active
                  ? "cursor-pointer bg-muted/60 ring-1 ring-inset ring-lane-blue/30"
                  : "cursor-pointer hover:bg-muted/40"
              }
            >
              <DenseCell className="min-w-0 flex-1">
                <button
                  type="button"
                  className="flex min-w-0 w-full items-center gap-3 text-left"
                  onClick={() => setSelectedId(row.partnerId)}
                >
                  <AvatarMark name={row.name} size="sm" />
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{row.name}</p>
                      {statusChip(status)}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {partner?.email ?? "No email"}
                      <span className="capitalize"> · {row.kind}</span>
                    </p>
                  </div>
                </button>
              </DenseCell>
              <DenseCell
                align="right"
                width="hidden w-28 sm:block"
                className="text-sm text-muted-foreground"
              >
                {moneyLabel(BigInt(row.earnedMinor), row.currency)}
              </DenseCell>
              <DenseCell align="right" width="w-28" className="text-sm font-medium">
                {moneyLabel(payable, row.currency)}
              </DenseCell>
              <DenseCell align="right" width="w-20">
                <div onClick={(event) => event.stopPropagation()}>
                  {canWrite && payable > BigInt(0) ? (
                    <RecordSettlementDialog
                      orgSlug={orgSlug}
                      partners={partners}
                      defaultCurrency={row.currency}
                      defaultPartnerId={row.partnerId}
                      defaultAmount={formatMoney({
                        amountMinor: payable,
                        currency: row.currency,
                      }).replace(/[^\d.]/g, "")}
                      triggerLabel="Settle"
                      triggerVariant="outline"
                      triggerSize="icon-sm"
                      triggerIconOnly
                      triggerAriaLabel={`Settle ${partner?.name ?? "partner"}`}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </DenseCell>
            </DenseRow>
          );
        })}
      </DenseListPanel>

      <SoftCard className="flex w-full shrink-0 flex-col overflow-hidden p-0 md:w-[22rem]">
        {selectedPartner && selected ? (
          <>
            <div className="border-b border-border/40 px-5 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <AvatarMark name={selectedPartner.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold tracking-tight">
                    {selectedPartner.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
                    {selectedPartner.kind}
                    {selectedPartner.active ? "" : " · inactive"}
                  </p>
                </div>
                {canWrite ? (
                  <EditPartnerDialog
                    orgSlug={orgSlug}
                    partner={selectedPartner}
                  />
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
              <section>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Access
                  </p>
                  {statusChip(selectedStatus)}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {accessCopy(selectedStatus, Boolean(selectedPartner.email))}
                </p>
                {selectedPartner.email ? (
                  <a
                    href={`mailto:${selectedPartner.email}`}
                    className="mt-2 block truncate text-sm font-medium hover:underline"
                  >
                    {selectedPartner.email}
                  </a>
                ) : null}
                {canInvite && selectedStatus !== "active" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {selectedInvite ? (
                      <>
                        <ResendInviteButton
                          orgSlug={orgSlug}
                          invitationId={selectedInvite.id}
                          label={
                            selectedStatus === "expired"
                              ? "Re-invite"
                              : "Resend invite"
                          }
                          variant="default"
                        />
                        <RevokeInviteButton
                          orgSlug={orgSlug}
                          invitationId={selectedInvite.id}
                          iconOnly
                        />
                      </>
                    ) : selectedPartner.email ? (
                      <InvitePartnerLoginButton
                        orgSlug={orgSlug}
                        partnerId={selectedPartner.id}
                        label="Send invite"
                        variant="default"
                      />
                    ) : canWrite ? (
                      <EditPartnerDialog
                        orgSlug={orgSlug}
                        partner={selectedPartner}
                        triggerVariant="default"
                        triggerLabel="Add email"
                        triggerIconOnly={false}
                        triggerSize="sm"
                        triggerIcon={<Pencil className="size-3.5" />}
                      />
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Balance
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Payable</dt>
                    <dd className="font-semibold tabular-nums">
                      {moneyLabel(selectedPayable, selected.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Earned</dt>
                    <dd className="tabular-nums text-muted-foreground">
                      {moneyLabel(BigInt(selected.earnedMinor), selected.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Settled</dt>
                    <dd className="tabular-nums text-muted-foreground">
                      {moneyLabel(BigInt(selected.settledMinor), selected.currency)}
                    </dd>
                  </div>
                </dl>
                {canWrite && selectedPayable > BigInt(0) ? (
                  <div className="mt-3">
                    <RecordSettlementDialog
                      orgSlug={orgSlug}
                      partners={partners}
                      defaultCurrency={selected.currency}
                      defaultPartnerId={selected.partnerId}
                      defaultAmount={formatMoney({
                        amountMinor: selectedPayable,
                        currency: selected.currency,
                      }).replace(/[^\d.]/g, "")}
                      triggerLabel="Settle balance"
                      triggerVariant="default"
                      triggerSize="sm"
                    />
                  </div>
                ) : null}
              </section>

              <section>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Projects
                </p>
                {selectedProjects.length > 0 ? (
                  <ul className="mt-2 -mx-2">
                    {selectedProjects.map((project) => (
                      <li key={project.id}>
                        <Link
                          href={`/${orgSlug}/projects/${project.id}?tab=split`}
                          className="block truncate rounded-xl px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          {project.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Not on a project yet.
                  </p>
                )}
              </section>

              {selectedPartner.notes?.trim() ? (
                <section>
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Notes
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {selectedPartner.notes}
                  </p>
                </section>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col p-5">
            <p className="text-sm font-semibold tracking-tight">Partner details</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Invite a partner to track splits and settlements.
            </p>
            <div className="mt-auto pt-6">
              {canWrite ? <CreatePartnerDialog orgSlug={orgSlug} /> : null}
            </div>
          </div>
        )}
      </SoftCard>
    </Workbench>
  );
}
