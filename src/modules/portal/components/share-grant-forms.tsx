"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  createShareGrantAction,
  revokeShareGrantAction,
} from "@/modules/portal/actions";
import type { ShareGrantRecord } from "@/modules/portal/types";

export function CreateShareGrantForm({
  orgSlug,
  clients,
  partners,
}: {
  orgSlug: string;
  clients: { id: string; name: string }[];
  partners: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"client" | "partner">("client");
  const [tokenOnce, setTokenOnce] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-3"
        action={(formData) => {
          start(async () => {
            const result = await createShareGrantAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            if (result.token) {
              setTokenOnce(result.token);
              toast.success("Share link created — copy the token now");
            }
            router.refresh();
          });
        }}
      >
        <Field label="Kind" htmlFor="kind">
          <NativeSelect
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value === "partner" ? "partner" : "client")}
          >
            <option value="client">Client portal</option>
            <option value="partner">Partner portal</option>
          </NativeSelect>
        </Field>
        {kind === "client" ? (
          <Field label="Client" htmlFor="client_id">
            <NativeSelect id="client_id" name="client_id" required>
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <Field label="Partner" htmlFor="partner_id">
            <NativeSelect id="partner_id" name="partner_id" required>
              <option value="">Select…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="Label" htmlFor="label">
          <Input id="label" name="label" placeholder="Q2 client share" />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Expose</legend>
          {(kind === "client"
            ? (["invoices", "milestones", "documents", "files"] as const)
            : (["earnings"] as const)
          ).map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="expose" value={item} defaultChecked />
              {item}
            </label>
          ))}
        </fieldset>
        <Field label="Expires" htmlFor="expires_at">
          <Input id="expires_at" name="expires_at" type="datetime-local" />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create share link"}
        </Button>
      </form>

      {tokenOnce ? (
        <div className="rounded-2xl bg-muted/60 p-4 text-sm">
          <p className="mb-2 font-medium">Copy once — not shown again</p>
          <code className="break-all text-xs">{typeof window !== "undefined" ? `${window.location.origin}/portal/${tokenOnce}` : `/portal/${tokenOnce}`}</code>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={async () => {
              const url = `${window.location.origin}/portal/${tokenOnce}`;
              await navigator.clipboard.writeText(url);
              toast.success("Copied");
            }}
          >
            Copy URL
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ShareGrantList({
  orgSlug,
  grants,
}: {
  orgSlug: string;
  grants: ShareGrantRecord[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (grants.length === 0) {
    return <p className="text-sm text-muted-foreground">No share links yet.</p>;
  }

  return (
    <ul className="divide-y divide-border/60 rounded-2xl border border-border/60">
      {grants.map((grant) => (
        <li key={grant.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{grant.label ?? grant.scope.kind}</p>
            <p className="text-xs text-muted-foreground">
              {grant.scope.kind === "client"
                ? `Client · ${grant.scope.expose.join(", ")}`
                : `Partner · ${grant.scope.expose.join(", ")}`}
              {grant.revokedAt ? " · revoked" : ""}
              {grant.expiresAt ? ` · expires ${grant.expiresAt.slice(0, 10)}` : ""}
            </p>
          </div>
          {!grant.revokedAt ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  const result = await revokeShareGrantAction(orgSlug, grant.id);
                  if (result.error) toast.error(result.error);
                  else toast.success("Revoked");
                  router.refresh();
                });
              }}
            >
              Revoke
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
