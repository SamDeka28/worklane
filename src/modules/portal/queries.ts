import { createAdminSupabaseClient } from "@/shared/db/supabase/admin";
import { hashShareToken } from "@/modules/portal/token";
import { isShareScope, type ShareGrantRecord, type ShareScope } from "@/modules/portal/types";
import type { IsoCurrency } from "@/shared/money";

export type PortalInvoice = {
  id: string;
  number: string;
  status: string;
  currency: IsoCurrency;
  issuedOn: string | null;
  dueOn: string | null;
  totalMinor: bigint;
};

export type PortalMilestone = {
  id: string;
  name: string;
  status: string;
  dueOn: string | null;
  projectName: string;
};

export type PortalDocument = {
  id: string;
  title: string;
  kind: string;
  status: string;
};

export type PortalFile = {
  id: string;
  name: string;
  mime: string | null;
};

export type PortalPartnerEarning = {
  earnedMinor: bigint;
  settledMinor: bigint;
  currency: IsoCurrency;
};

export type PortalView = {
  grant: ShareGrantRecord;
  orgName: string;
  clientName?: string;
  partnerName?: string;
  invoices: PortalInvoice[];
  milestones: PortalMilestone[];
  documents: PortalDocument[];
  files: PortalFile[];
  earnings?: PortalPartnerEarning;
};

function asCurrency(value: string): IsoCurrency {
  return value === "INR" ? "INR" : "USD";
}

function mapGrant(row: {
  id: string;
  organization_id: string;
  label: string | null;
  scope: unknown;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  created_by: string | null;
}): ShareGrantRecord | null {
  if (!isShareScope(row.scope)) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    label: row.label,
    scope: row.scope,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export async function loadPortalByToken(rawToken: string): Promise<PortalView | null> {
  const admin = createAdminSupabaseClient();
  if (!admin || !rawToken) return null;

  const tokenHash = hashShareToken(rawToken);
  const { data: grantRow, error } = await admin
    .from("share_grants")
    .select(
      "id, organization_id, label, scope, expires_at, revoked_at, created_at, created_by",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !grantRow) return null;
  const grant = mapGrant(grantRow);
  if (!grant || grant.revokedAt) return null;
  if (grant.expiresAt && new Date(grant.expiresAt).getTime() < Date.now()) return null;

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", grant.organizationId)
    .maybeSingle();

  const scope = grant.scope;
  const expose = new Set(scope.expose);

  const view: PortalView = {
    grant,
    orgName: org?.name ?? "Studio",
    invoices: [],
    milestones: [],
    documents: [],
    files: [],
  };

  if (scope.kind === "client") {
    const { data: client } = await admin
      .from("clients")
      .select("id, name")
      .eq("id", scope.client_id)
      .eq("organization_id", grant.organizationId)
      .maybeSingle();
    if (!client) return null;
    view.clientName = client.name;

    if (expose.has("invoices")) {
      const { data: invoices } = await admin
        .from("invoices")
        .select("id, number, status, currency, issued_on, due_on")
        .eq("organization_id", grant.organizationId)
        .eq("client_id", scope.client_id)
        .neq("status", "void")
        .order("created_at", { ascending: false })
        .limit(50);

      const ids = (invoices ?? []).map((row) => row.id as string);
      const totals = new Map<string, bigint>();
      if (ids.length > 0) {
        const { data: lines } = await admin
          .from("invoice_lines")
          .select("invoice_id, quantity, unit_amount_minor, tax_bps, discount_minor")
          .eq("organization_id", grant.organizationId)
          .in("invoice_id", ids);
        for (const line of lines ?? []) {
          const qtyMillis = BigInt(Math.round(Number(line.quantity) * 1000));
          const gross =
            (qtyMillis * BigInt(line.unit_amount_minor)) / BigInt(1000);
          const discount = BigInt(line.discount_minor ?? 0);
          const after = gross > discount ? gross - discount : BigInt(0);
          const tax = (after * BigInt(line.tax_bps ?? 0)) / BigInt(10_000);
          const prev = totals.get(line.invoice_id as string) ?? BigInt(0);
          totals.set(line.invoice_id as string, prev + after + tax);
        }
      }

      view.invoices = (invoices ?? []).map((row) => ({
        id: row.id as string,
        number: row.number as string,
        status: row.status as string,
        currency: asCurrency(String(row.currency)),
        issuedOn: row.issued_on as string | null,
        dueOn: row.due_on as string | null,
        totalMinor: totals.get(row.id as string) ?? BigInt(0),
      }));
    }

    if (expose.has("milestones") || expose.has("projects")) {
      const { data: projects } = await admin
        .from("projects")
        .select("id, name")
        .eq("organization_id", grant.organizationId)
        .eq("client_id", scope.client_id);
      const projectIds = (projects ?? []).map((p) => p.id as string);
      const projectNames = new Map(
        (projects ?? []).map((p) => [p.id as string, p.name as string]),
      );

      if (expose.has("milestones") && projectIds.length > 0) {
        const { data: milestones } = await admin
          .from("milestones")
          // NEVER select partner splits / internal notes
          .select("id, name, status, due_on, project_id")
          .eq("organization_id", grant.organizationId)
          .in("project_id", projectIds)
          .order("due_on", { ascending: true, nullsFirst: false });

        view.milestones = (milestones ?? []).map((row) => ({
          id: row.id as string,
          name: row.name as string,
          status: row.status as string,
          dueOn: row.due_on as string | null,
          projectName: projectNames.get(row.project_id as string) ?? "Project",
        }));
      }
    }

    if (expose.has("documents")) {
      const { data: documents } = await admin
        .from("documents")
        .select("id, title, kind, status")
        .eq("organization_id", grant.organizationId)
        .eq("client_id", scope.client_id)
        .in("status", ["sent", "accepted", "signed"])
        .order("updated_at", { ascending: false })
        .limit(40);
      view.documents = (documents ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        kind: row.kind as string,
        status: row.status as string,
      }));
    }

    if (expose.has("files")) {
      const { data: files } = await admin
        .from("files")
        .select("id, name, mime, entity_type, entity_id")
        .eq("organization_id", grant.organizationId)
        .eq("visibility", "shared")
        .is("deleted_at", null)
        .limit(40);
      // Only client-scoped shared files: invoices / documents for this client
      const docIds = new Set(view.documents.map((d) => d.id));
      const invoiceIds = new Set(view.invoices.map((i) => i.id));
      view.files = (files ?? [])
        .filter((row) => {
          const type = row.entity_type as string;
          const id = row.entity_id as string;
          if (type === "document" || type === "document_version") return docIds.has(id);
          if (type === "invoice") return invoiceIds.has(id);
          return false;
        })
        .map((row) => ({
          id: row.id as string,
          name: row.name as string,
          mime: row.mime as string | null,
        }));
    }
  }

  if (scope.kind === "partner") {
    const { data: partner } = await admin
      .from("partners")
      .select("id, name")
      .eq("id", scope.partner_id)
      .eq("organization_id", grant.organizationId)
      .maybeSingle();
    if (!partner) return null;
    view.partnerName = partner.name;

    if (expose.has("earnings")) {
      const { data: allocations } = await admin
        .from("partner_allocations")
        .select("earned_minor, currency, status")
        .eq("organization_id", grant.organizationId)
        .eq("partner_id", scope.partner_id)
        .eq("status", "posted");
      const { data: settlements } = await admin
        .from("partner_settlements")
        .select("amount_minor, currency, status")
        .eq("organization_id", grant.organizationId)
        .eq("partner_id", scope.partner_id)
        .eq("status", "posted");

      const currency = asCurrency(
        String(allocations?.[0]?.currency ?? settlements?.[0]?.currency ?? "USD"),
      );
      const earnedMinor = (allocations ?? []).reduce(
        (sum, row) => sum + BigInt(row.earned_minor),
        BigInt(0),
      );
      const settledMinor = (settlements ?? []).reduce(
        (sum, row) => sum + BigInt(row.amount_minor),
        BigInt(0),
      );
      view.earnings = { earnedMinor, settledMinor, currency };
    }
  }

  return view;
}

export async function listShareGrants(orgSlug: string): Promise<ShareGrantRecord[]> {
  const { requireOrg } = await import("@/modules/identity/org");
  const ctx = await requireOrg(orgSlug);
  if (!ctx.org.modules.portal) return [];

  const { data, error } = await ctx.supabase
    .from("share_grants")
    .select(
      "id, organization_id, label, scope, expires_at, revoked_at, created_at, created_by",
    )
    .eq("organization_id", ctx.org.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (error.message.includes("share_grants") || error.code === "42P01") return [];
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => mapGrant(row))
    .filter((row): row is ShareGrantRecord => Boolean(row));
}

export type { ShareScope };
