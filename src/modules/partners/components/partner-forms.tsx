"use client";

import { Lock, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SoftDocField } from "@/components/editor/soft-doc-field";
import { ActionSheet } from "@/components/studio/action-sheet";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  addProjectMembersAction,
  addProjectPartnersAction,
  createPartnerAction,
  recordPartnerSettlementAction,
  removeProjectMemberAction,
  removeProjectPartnerAction,
  setProjectDistributionAction,
  updatePartnerAction,
} from "@/modules/partners/actions";
import { InviteMemberForm } from "@/modules/team/components/invite-forms";
import {
  compilePoolRemainderDistribution,
} from "@/modules/partners/ledger";
import type {
  DistributionLineRole,
  PartnerRecord,
  ProjectMemberRecord,
} from "@/modules/partners/types";
import { moneyLabel } from "@/modules/finance/ledger";
import { formatMajorInput, netFromGross, parseMajorToMinor } from "@/shared/money";

export type SplitDialogSeed = {
  poolAmountMinor: string;
  label?: string | null;
  lines: {
    partnerId: string;
    role: DistributionLineRole;
    poolShareBps: number | null;
    shareBps: number;
  }[];
};

function formatPoolAmountInput(amountMinor: bigint, currency: "USD" | "INR") {
  const raw = formatMajorInput(amountMinor, currency);
  return raw.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatSharePct(bps: number) {
  const pct = bps / 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, "");
}

function parseShareBps(raw: string | undefined): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function distributeBps(totalBps: number, ids: string[]): Record<string, number> {
  if (ids.length === 0) return {};
  if (totalBps <= 0) return Object.fromEntries(ids.map((id) => [id, 0]));
  const base = Math.floor(totalBps / ids.length);
  let leftover = totalBps - base * ids.length;
  const next: Record<string, number> = {};
  for (const id of ids) {
    next[id] = base + (leftover > 0 ? 1 : 0);
    if (leftover > 0) leftover -= 1;
  }
  return next;
}

function rebalanceShares(
  partnerIds: string[],
  shares: Record<string, string>,
  locked: Record<string, boolean>,
  editedId?: string,
): Record<string, string> {
  const lockedIds = partnerIds.filter((id) => locked[id]);
  const unlockedIds = partnerIds.filter((id) => !locked[id]);
  const lockedBps = lockedIds.reduce((sum, id) => sum + parseShareBps(shares[id]), 0);
  const remaining = Math.max(0, 10000 - lockedBps);

  if (unlockedIds.length === 0) {
    return { ...shares };
  }

  const next = { ...shares };
  if (unlockedIds.length === 1) {
    next[unlockedIds[0]] = formatSharePct(remaining);
    return next;
  }

  if (editedId && unlockedIds.includes(editedId)) {
    const editedBps = Math.min(remaining, parseShareBps(shares[editedId]));
    next[editedId] = formatSharePct(editedBps);
    const others = unlockedIds.filter((id) => id !== editedId);
    const distributed = distributeBps(remaining - editedBps, others);
    for (const id of others) {
      next[id] = formatSharePct(distributed[id] ?? 0);
    }
    return next;
  }

  const distributed = distributeBps(remaining, unlockedIds);
  for (const id of unlockedIds) {
    next[id] = formatSharePct(distributed[id] ?? 0);
  }
  return next;
}

export function CreatePartnerDialog({
  orgSlug,
  defaultOpen = false,
  triggerVariant = "default",
  triggerLabel = "Invite partner",
}: {
  orgSlug: string;
  defaultOpen?: boolean;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();

  return (
    <ActionSheet
      title="Invite partner"
      description="Email an invite so they can create an account and log in as a partner."
      triggerLabel={triggerLabel}
      triggerVariant={triggerVariant}
      open={open}
      onOpenChange={setOpen}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await createPartnerAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            if ("warning" in result && result.warning) {
              toast.message(result.warning);
            } else if (result.alreadyMember) {
              toast.success("Partner linked — they already have studio access");
            } else if (result.emailed) {
              toast.success("Partner invited by email");
            } else if (result.acceptUrl) {
              toast.success("Partner saved (email not configured)");
              try {
                await navigator.clipboard.writeText(result.acceptUrl);
                toast.message("Invite link copied");
              } catch {
                /* ignore */
              }
            } else {
              toast.success("Partner invited");
            }
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field label="Name" htmlFor="partner_name" required>
          <Input id="partner_name" name="name" required placeholder="Rahul" />
        </Field>
        <Field label="Email" htmlFor="partner_email" required hint="They’ll get an invite to log in as a partner">
          <Input
            id="partner_email"
            name="email"
            type="email"
            required
            placeholder="partner@studio.com"
          />
        </Field>
        <Field label="Kind" htmlFor="partner_kind" hint="Independent of money splits">
          <NativeSelect id="partner_kind" name="kind" defaultValue="participant">
            <option value="originator">Originator</option>
            <option value="participant">Participant</option>
            <option value="referral">Referral</option>
          </NativeSelect>
        </Field>
        <SoftDocField
          label="Notes"
          name="notes"
          orgSlug={orgSlug}
          placeholder="Payout details or other internal notes"
        />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </form>
    </ActionSheet>
  );
}

export function EditPartnerDialog({
  orgSlug,
  partner,
  triggerLabel = "Edit",
  triggerVariant = "outline",
}: {
  orgSlug: string;
  partner: PartnerRecord;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <ActionSheet
      title="Edit partner"
      description="Updates the studio partner record — not project splits."
      triggerLabel={triggerLabel}
      triggerVariant={triggerVariant}
      open={open}
      onOpenChange={setOpen}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await updatePartnerAction(orgSlug, partner.id, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Partner updated");
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field label="Name" htmlFor={`edit_partner_name_${partner.id}`} required>
          <Input
            id={`edit_partner_name_${partner.id}`}
            name="name"
            required
            defaultValue={partner.name}
          />
        </Field>
        <Field label="Email" htmlFor={`edit_partner_email_${partner.id}`} hint="Used for login invites">
          <Input
            id={`edit_partner_email_${partner.id}`}
            name="email"
            type="email"
            defaultValue={partner.email ?? ""}
            placeholder="partner@studio.com"
          />
        </Field>
        <Field label="Kind" htmlFor={`edit_partner_kind_${partner.id}`}>
          <NativeSelect
            id={`edit_partner_kind_${partner.id}`}
            name="kind"
            defaultValue={partner.kind}
          >
            <option value="originator">Originator</option>
            <option value="participant">Participant</option>
            <option value="referral">Referral</option>
          </NativeSelect>
        </Field>
        <SoftDocField
          label="Notes"
          name="notes"
          orgSlug={orgSlug}
          initialPlain={partner.notes}
          placeholder="Internal only — never on client portal"
        />
        <Field label="Status" htmlFor={`edit_partner_active_${partner.id}`}>
          <NativeSelect
            id={`edit_partner_active_${partner.id}`}
            name="active"
            defaultValue={partner.active ? "true" : "false"}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </NativeSelect>
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </ActionSheet>
  );
}

export function RecordSettlementDialog({
  orgSlug,
  partners,
  defaultCurrency,
  defaultPartnerId,
  defaultAmount,
  triggerLabel = "Settle",
  triggerVariant = "default",
  defaultOpen = false,
}: {
  orgSlug: string;
  partners: PartnerRecord[];
  defaultCurrency: string;
  defaultPartnerId?: string;
  defaultAmount?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const selected =
    partners.find((partner) => partner.id === defaultPartnerId)?.id ?? partners[0]?.id;

  return (
    <ActionSheet
      title="Settle partner"
      description="Pays what they earned. Does not touch client receipts."
      triggerLabel={triggerLabel}
      triggerVariant={triggerVariant}
      triggerDisabled={partners.length === 0}
      open={open}
      onOpenChange={setOpen}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await recordPartnerSettlementAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Settlement recorded");
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field label="Partner" htmlFor="settle_partner" required>
          <NativeSelect id="settle_partner" name="partner_id" required defaultValue={selected}>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Amount" htmlFor="settle_amount" required>
          <Input
            id="settle_amount"
            name="amount"
            required
            inputMode="decimal"
            placeholder="332.50"
            defaultValue={defaultAmount}
          />
        </Field>
        <input type="hidden" name="currency" value={defaultCurrency} />
        <Field label="Method" htmlFor="settle_method">
          <NativeSelect id="settle_method" name="method" defaultValue="bank">
            <option value="bank">Bank</option>
            <option value="upwork">Upwork</option>
            <option value="stripe">Stripe</option>
            <option value="other">Other</option>
          </NativeSelect>
        </Field>
        <Field label="Settled on" htmlFor="settled_on">
          <Input
            id="settled_on"
            name="settled_on"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>
        <Field label="Memo" htmlFor="settle_memo">
          <Input id="settle_memo" name="memo" placeholder="August payout…" />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending || partners.length === 0}>
          {pending ? "Saving…" : "Record settlement"}
        </Button>
      </form>
    </ActionSheet>
  );
}

export function ProjectSplitDialog({
  orgSlug,
  projects,
  partners,
  partnersByProjectId,
  currency = "USD",
  initialSplit,
  initialSplitsByProjectId,
  triggerVariant = "outline",
  defaultProjectId,
  defaultOpen = false,
  triggerLabel = "Set split",
}: {
  orgSlug: string;
  projects: { id: string; name: string; totalMinor?: string; feeBps?: number }[];
  partners?: PartnerRecord[];
  partnersByProjectId?: Record<string, PartnerRecord[]>;
  currency?: "USD" | "INR";
  /** Latest saved split for the default project (reopen Edit split with real values). */
  initialSplit?: SplitDialogSeed | null;
  initialSplitsByProjectId?: Record<string, SplitDialogSeed>;
  triggerVariant?: "default" | "outline" | "ghost";
  defaultProjectId?: string;
  defaultOpen?: boolean;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, start] = useTransition();
  const initialProject =
    defaultProjectId && projects.some((p) => p.id === defaultProjectId)
      ? defaultProjectId
      : projects[0]?.id;
  const [projectId, setProjectId] = useState(initialProject ?? "");

  useEffect(() => {
    if (open) setProjectId(initialProject ?? "");
  }, [open, initialProject]);

  const selectedProject = projects.find((project) => project.id === projectId);
  const grossMinor = BigInt(selectedProject?.totalMinor ?? "0");
  const feeBps = Number.isFinite(selectedProject?.feeBps)
    ? Math.max(0, Math.min(10_000, Number(selectedProject?.feeBps)))
    : 0;
  const projectTotalMinor =
    grossMinor > BigInt(0) ? netFromGross(grossMinor, feeBps) : BigInt(0);
  const feeMinor = grossMinor > projectTotalMinor ? grossMinor - projectTotalMinor : BigInt(0);

  const poolPartners = useMemo(() => {
    if (partnersByProjectId && projectId) {
      return (partnersByProjectId[projectId] ?? []).filter((partner) => partner.active);
    }
    return (partners ?? []).filter((partner) => partner.active);
  }, [partners, partnersByProjectId, projectId]);

  const partnerKey = poolPartners.map((partner) => partner.id).join("|");

  const seedForProject = useMemo(() => {
    if (initialSplitsByProjectId?.[projectId]) return initialSplitsByProjectId[projectId];
    if (initialSplit && (!defaultProjectId || defaultProjectId === projectId)) {
      return initialSplit;
    }
    return null;
  }, [initialSplit, initialSplitsByProjectId, projectId, defaultProjectId]);

  const seededDefaults = useMemo(() => {
    const fallbackRoles: Record<string, "pool" | "remainder"> = {};
    poolPartners.forEach((partner, index) => {
      fallbackRoles[partner.id] =
        poolPartners.length >= 3 && index === poolPartners.length - 1 ? "remainder" : "pool";
    });

    const seed = seedForProject;
    if (!seed || seed.lines.length === 0) {
      const poolIds = poolPartners
        .filter((partner) => fallbackRoles[partner.id] === "pool")
        .map((partner) => partner.id);
      const shares: Record<string, string> = {};
      if (poolIds.length === 1) {
        shares[poolIds[0]] = "100";
      } else if (poolIds.length > 1) {
        const even = Math.floor(10000 / poolIds.length);
        let used = 0;
        poolIds.forEach((id, index) => {
          if (index === poolIds.length - 1) {
            shares[id] = formatSharePct(10000 - used);
            return;
          }
          shares[id] = formatSharePct(even);
          used += even;
        });
      }
      const locked: Record<string, boolean> = {};
      poolIds.forEach((id, index) => {
        locked[id] = poolIds.length >= 2 && index < poolIds.length - 1;
      });
      const suggested =
        projectTotalMinor > BigInt(0)
          ? formatPoolAmountInput((projectTotalMinor * BigInt(60)) / BigInt(100), currency)
          : "";
      return {
        roles: fallbackRoles,
        shares,
        locked,
        poolAmount: suggested,
        label: "",
      };
    }

    const roles: Record<string, "pool" | "remainder"> = { ...fallbackRoles };
    const shares: Record<string, string> = {};
    const poolAmountMinor = BigInt(seed.poolAmountMinor);
    for (const line of seed.lines) {
      roles[line.partnerId] = line.role;
      if (line.role === "pool") {
        let poolShare = line.poolShareBps;
        if (poolShare == null && poolAmountMinor > BigInt(0) && projectTotalMinor > BigInt(0)) {
          poolShare = Number((BigInt(line.shareBps) * projectTotalMinor) / poolAmountMinor);
        }
        shares[line.partnerId] = formatSharePct(poolShare ?? line.shareBps);
      }
    }
    const poolIds = poolPartners
      .filter((partner) => roles[partner.id] === "pool")
      .map((partner) => partner.id);
    const locked: Record<string, boolean> = {};
    poolIds.forEach((id, index) => {
      locked[id] = poolIds.length >= 2 && index < poolIds.length - 1;
    });
    return {
      roles,
      shares,
      locked,
      poolAmount: formatPoolAmountInput(poolAmountMinor, currency),
      label: seed.label ?? "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerKey, projectId, seedForProject, projectTotalMinor, currency]);

  const [roles, setRoles] = useState(seededDefaults.roles);
  const [shares, setShares] = useState(seededDefaults.shares);
  const [locked, setLocked] = useState(seededDefaults.locked);
  const [poolAmount, setPoolAmount] = useState(seededDefaults.poolAmount);
  const [label, setLabel] = useState(seededDefaults.label);

  useEffect(() => {
    if (!open) return;
    setRoles(seededDefaults.roles);
    setShares(seededDefaults.shares);
    setLocked(seededDefaults.locked);
    setPoolAmount(seededDefaults.poolAmount);
    setLabel(seededDefaults.label);
  }, [open, seededDefaults]);

  const poolIds = poolPartners
    .filter((partner) => roles[partner.id] === "pool")
    .map((partner) => partner.id);
  const remainderIds = poolPartners
    .filter((partner) => roles[partner.id] === "remainder")
    .map((partner) => partner.id);

  const unlockedPoolIds = poolIds.filter((id) => !locked[id]);

  let poolAmountMinor = BigInt(0);
  let poolParseError: string | null = null;
  try {
    if (poolAmount.trim()) {
      poolAmountMinor = parseMajorToMinor(poolAmount, currency);
    }
  } catch (error) {
    poolParseError = error instanceof Error ? error.message : "Invalid pool amount";
  }

  const remainderMinor =
    projectTotalMinor > poolAmountMinor ? projectTotalMinor - poolAmountMinor : BigInt(0);

  let compiled: ReturnType<typeof compilePoolRemainderDistribution> | null = null;
  let compileError: string | null = poolParseError;
  if (!compileError && poolPartners.length > 0 && poolAmountMinor > BigInt(0)) {
    try {
      compiled = compilePoolRemainderDistribution({
        projectTotalMinor,
        poolAmountMinor,
        poolLines: poolIds.map((id) => ({
          partnerId: id,
          poolShareBps: parseShareBps(shares[id]),
        })),
        remainderPartnerIds: remainderIds,
      });
    } catch (error) {
      compileError = error instanceof Error ? error.message : "Invalid split";
    }
  }

  const canOpen =
    projects.length > 0 &&
    (partnersByProjectId
      ? Object.values(partnersByProjectId).some((list) => list.some((p) => p.active))
      : (partners ?? []).some((p) => p.active));

  function updatePoolShare(partnerId: string, value: string) {
    const cleaned = value.replace(/[^\d.]/g, "");
    setShares((prev) => {
      const draft = { ...prev, [partnerId]: cleaned };
      if (cleaned === "" || cleaned === "." || cleaned.endsWith(".")) return draft;
      const lockMap = Object.fromEntries(poolIds.map((id) => [id, Boolean(locked[id])]));
      if (locked[partnerId]) {
        return rebalanceShares(poolIds, draft, lockMap);
      }
      return rebalanceShares(poolIds, draft, lockMap, partnerId);
    });
  }

  function toggleLock(partnerId: string) {
    const nextLocked = { ...locked, [partnerId]: !locked[partnerId] };
    const unlockedCount = poolIds.filter((id) => !nextLocked[id]).length;
    if (unlockedCount === 0) {
      toast.error("Keep at least one pool partner unlocked");
      return;
    }
    setLocked(nextLocked);
    setShares((prev) => rebalanceShares(poolIds, prev, nextLocked));
  }

  function setRole(partnerId: string, role: "pool" | "remainder") {
    setRoles((prev) => {
      const next = { ...prev, [partnerId]: role };
      if (role === "remainder") {
        for (const partner of poolPartners) {
          if (partner.id !== partnerId && next[partner.id] === "remainder") {
            next[partner.id] = "pool";
          }
        }
      }
      const nextPoolIds = poolPartners
        .filter((partner) => next[partner.id] === "pool")
        .map((partner) => partner.id);
      setShares((prevShares) => {
        const seeded = { ...prevShares };
        for (const id of nextPoolIds) {
          if (!seeded[id]) seeded[id] = nextPoolIds.length === 1 ? "100" : "0";
        }
        const lockMap = Object.fromEntries(
          nextPoolIds.map((id, index) => [
            id,
            nextPoolIds.length >= 2 && index < nextPoolIds.length - 1,
          ]),
        );
        setLocked(lockMap);
        return rebalanceShares(nextPoolIds, seeded, lockMap);
      });
      return next;
    });
  }

  return (
    <ActionSheet
      title="Set project split"
      description="Set a build/target pool of the distributable amount (after platform fee). Whoever takes the remainder gets the rest."
      triggerLabel={triggerLabel}
      triggerVariant={triggerVariant}
      triggerDisabled={!canOpen}
      open={open}
      onOpenChange={setOpen}
    >
      <form
        className="grid gap-4"
        action={(formData) => {
          const selected = String(formData.get("project_id") ?? "");
          start(async () => {
            const result = await setProjectDistributionAction(orgSlug, selected, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Split version saved");
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field label="Project" htmlFor="split_project" required>
          <NativeSelect
            id="split_project"
            name="project_id"
            required
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <div className="space-y-2 rounded-2xl bg-muted/50 px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Client total</span>
            <span className="font-medium tabular-nums">
              {grossMinor > BigInt(0) ? moneyLabel(grossMinor, currency) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Platform fee{feeBps > 0 ? ` (${(feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2)}%)` : ""}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {feeMinor > BigInt(0) ? `−${moneyLabel(feeMinor, currency)}` : moneyLabel(BigInt(0), currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
            <span className="text-xs font-medium">Distributable</span>
            <span className="font-semibold tabular-nums">
              {projectTotalMinor > BigInt(0)
                ? moneyLabel(projectTotalMinor, currency)
                : "Add milestone prices first"}
            </span>
          </div>
        </div>

        <Field
          label="Build / target pool"
          htmlFor="pool_amount"
          hint="Of the distributable amount after fee (e.g. 4800 of ~7742 net)"
          required
        >
          <Input
            id="pool_amount"
            name="pool_amount"
            inputMode="decimal"
            required
            value={poolAmount}
            onChange={(event) => setPoolAmount(event.target.value)}
            placeholder="4800"
          />
        </Field>

        <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Remainder</span>
          <span className="font-semibold tabular-nums">
            {poolParseError ? "—" : moneyLabel(remainderMinor, currency)}
          </span>
        </div>

        <Field label="Label" htmlFor="split_label">
          <Input
            id="split_label"
            name="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="LMS build pool 4800"
          />
        </Field>
        <Field label="Effective on" htmlFor="effective_on">
          <Input
            id="effective_on"
            name="effective_on"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>

        {poolPartners.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200/80">
            Assign partners to this project first, then set the pool and remainder.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Mark who is in the pool vs who takes the remainder. Pool %s must total 100% of the
              pool (e.g. 45 / 55).
            </p>
            {poolPartners.map((partner) => {
              const role = roles[partner.id] ?? "pool";
              const isPool = role === "pool";
              const isSoloUnlocked = isPool && unlockedPoolIds.length === 1 && !locked[partner.id];
              const line = compiled?.find((row) => row.partnerId === partner.id);
              return (
                <div
                  key={partner.id}
                  className="space-y-2 rounded-2xl px-3 py-2.5 ring-1 ring-border/40"
                >
                  <input type="hidden" name="partner_id" value={partner.id} />
                  <input type="hidden" name="role" value={role} />
                  {isPool ? (
                    <input type="hidden" name="share_pct" value={shares[partner.id] ?? "0"} />
                  ) : (
                    <input type="hidden" name="share_pct" value="0" />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{partner.name}</span>
                    <div className="flex rounded-full bg-muted/60 p-0.5 text-xs">
                      <button
                        type="button"
                        className={
                          isPool
                            ? "rounded-full bg-card px-2.5 py-1 font-medium shadow-sm"
                            : "px-2.5 py-1 text-muted-foreground"
                        }
                        onClick={() => setRole(partner.id, "pool")}
                      >
                        In pool
                      </button>
                      <button
                        type="button"
                        className={
                          !isPool
                            ? "rounded-full bg-card px-2.5 py-1 font-medium shadow-sm"
                            : "px-2.5 py-1 text-muted-foreground"
                        }
                        onClick={() => setRole(partner.id, "remainder")}
                      >
                        Remainder
                      </button>
                    </div>
                  </div>
                  {isPool ? (
                    <div className="grid grid-cols-[auto_1fr_5.5rem] items-center gap-2">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className={locked[partner.id] ? "text-foreground" : "text-muted-foreground"}
                        aria-label={
                          locked[partner.id]
                            ? `Unlock ${partner.name}`
                            : `Lock ${partner.name}`
                        }
                        onClick={() => toggleLock(partner.id)}
                      >
                        {locked[partner.id] ? (
                          <Lock className="size-4" />
                        ) : (
                          <LockOpen className="size-4" />
                        )}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {locked[partner.id] ? "locked" : isSoloUnlocked ? "auto" : "flex"} · % of
                        pool
                      </span>
                      <Input
                        inputMode="decimal"
                        value={shares[partner.id] ?? ""}
                        readOnly={isSoloUnlocked}
                        tabIndex={isSoloUnlocked ? -1 : undefined}
                        className={isSoloUnlocked ? "bg-muted/50 text-muted-foreground" : undefined}
                        onChange={(event) => updatePoolShare(partner.id, event.target.value)}
                        aria-label={`${partner.name} pool percent`}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Gets {moneyLabel(remainderMinor, currency)} (
                      {projectTotalMinor > BigInt(0)
                        ? `${((Number(remainderMinor) / Number(projectTotalMinor)) * 100).toFixed(1)}%`
                        : "—"}{" "}
                      of distributable)
                    </p>
                  )}
                  {line ? (
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      Effective: {(line.shareBps / 100).toFixed(2)}% · collectible ~
                      {moneyLabel(
                        (projectTotalMinor * BigInt(line.shareBps)) / BigInt(10_000),
                        currency,
                      )}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {compileError ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200/80">
            {compileError}
          </p>
        ) : compiled ? (
          <div className="rounded-2xl bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950 ring-1 ring-emerald-200/70">
            Ready · pool {moneyLabel(poolAmountMinor, currency)} · remainder{" "}
            {moneyLabel(remainderMinor, currency)}
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending || !compiled || poolPartners.length === 0}
        >
          {pending ? "Saving…" : "Save version"}
        </Button>
      </form>
    </ActionSheet>
  );
}

export function ManageProjectPartnersDialog({
  orgSlug,
  projectId,
  assigned,
  available,
  triggerVariant = "outline",
  triggerLabel = "Add partners",
}: {
  orgSlug: string;
  projectId: string;
  assigned: PartnerRecord[];
  available: PartnerRecord[];
  triggerVariant?: "default" | "outline" | "ghost";
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const candidates = available.filter(
    (partner) => partner.active && !assigned.some((row) => row.id === partner.id),
  );

  return (
    <ActionSheet
      title="Project partners"
      description="Only these partners can take a share on this project’s split."
      triggerLabel={triggerLabel}
      triggerVariant={triggerVariant}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="grid gap-5">
        {assigned.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">On this project</p>
            <ul className="space-y-1">
              {assigned.map((partner) => (
                <li
                  key={partner.id}
                  className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm ring-1 ring-border/40"
                >
                  <span>{partner.name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      start(async () => {
                        const result = await removeProjectPartnerAction(
                          orgSlug,
                          projectId,
                          partner.id,
                        );
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Partner removed from project");
                        router.refresh();
                      });
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No partners assigned yet.</p>
        )}

        {candidates.length > 0 ? (
          <form
            className="grid gap-3"
            action={(formData) => {
              start(async () => {
                const result = await addProjectPartnersAction(orgSlug, projectId, formData);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Partners added");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <p className="text-xs font-medium text-muted-foreground">Add from studio partners</p>
            <div className="space-y-2">
              {candidates.map((partner) => (
                <label
                  key={partner.id}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm ring-1 ring-border/40"
                >
                  <input type="checkbox" name="partner_id" value={partner.id} className="size-4" />
                  <span>{partner.name}</span>
                </label>
              ))}
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Saving…" : "Add selected"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            {available.length === 0
              ? "Create partners under Partners first, then assign them here."
              : "Every active partner is already on this project."}
          </p>
        )}
      </div>
    </ActionSheet>
  );
}

export function ManageProjectTeamDialog({
  orgSlug,
  projectId,
  members,
  orgMembers,
  triggerVariant = "outline",
  triggerLabel = "Manage team",
}: {
  orgSlug: string;
  projectId: string;
  members: ProjectMemberRecord[];
  orgMembers: {
    userId: string;
    role: string;
    isYou: boolean;
    email?: string | null;
    displayName?: string | null;
  }[];
  triggerVariant?: "default" | "outline" | "ghost";
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const assignedIds = new Set(members.map((member) => member.userId));
  const candidates = orgMembers.filter(
    (member) =>
      !assignedIds.has(member.userId) &&
      (member.role === "owner" || member.role === "admin" || member.role === "member"),
  );

  const labelFor = (
    userId: string,
    isYou: boolean,
    email?: string | null,
    displayName?: string | null,
  ) => (isYou ? "You" : displayName || email || `Member ${userId.slice(0, 8)}`);

  return (
    <ActionSheet
      title="Project team"
      description="Assign studio members, or invite someone new by email."
      triggerLabel={triggerLabel}
      triggerVariant={triggerVariant}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="grid gap-5">
        {members.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Has access</p>
            <ul className="space-y-1">
              {members.map((member) => {
                const orgMember = orgMembers.find((row) => row.userId === member.userId);
                return (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm ring-1 ring-border/40"
                  >
                    <span>
                      {labelFor(
                        member.userId,
                        member.isYou,
                        orgMember?.email,
                        orgMember?.displayName,
                      )}
                      <span className="ml-2 text-xs capitalize text-muted-foreground">
                        {member.role}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        start(async () => {
                          const result = await removeProjectMemberAction(
                            orgSlug,
                            projectId,
                            member.userId,
                          );
                          if (result.error) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("Teammate removed");
                          router.refresh();
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No teammates assigned yet.</p>
        )}

        {candidates.length > 0 ? (
          <form
            className="grid gap-3"
            action={(formData) => {
              start(async () => {
                const result = await addProjectMembersAction(orgSlug, projectId, formData);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Team updated");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <p className="text-xs font-medium text-muted-foreground">Add teammates</p>
            <div className="space-y-2">
              {candidates.map((member) => (
                <label
                  key={member.userId}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm ring-1 ring-border/40"
                >
                  <input
                    type="checkbox"
                    name="user_id"
                    value={member.userId}
                    className="size-4"
                  />
                  <span>
                    {labelFor(member.userId, member.isYou, member.email, member.displayName)}
                    <span className="ml-2 text-xs capitalize text-muted-foreground">
                      {member.role}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <Field label="Role on project" htmlFor="project_member_role">
              <NativeSelect id="project_member_role" name="role" defaultValue="member">
                <option value="member">Member</option>
                <option value="lead">Lead</option>
              </NativeSelect>
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Saving…" : "Add selected"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Everyone eligible is already on this project.
          </p>
        )}

        <div className="border-t border-border/40 pt-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Invite by email
          </p>
          <InviteMemberForm
            orgSlug={orgSlug}
            defaultProjectId={projectId}
            compact
          />
        </div>
      </div>
    </ActionSheet>
  );
}

