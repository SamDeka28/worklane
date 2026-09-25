"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/studio/field";
import {
  signOutAction,
  updateOrgAction,
  updateOrgBusinessAction,
} from "@/modules/identity/actions";
import { ExtraFieldsEditor } from "@/modules/invoices/components/extra-fields-editor";
import type { InvoiceBusiness } from "@/modules/invoices/settings";

export function OrgSettingsForm({
  orgSlug,
  name,
  canWrite,
}: {
  orgSlug: string;
  name: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <form
        className="grid gap-4"
        action={(formData) => {
          start(async () => {
            const result = await updateOrgAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Studio updated");
            router.refresh();
          });
        }}
      >
        <Field label="Studio name" htmlFor="name">
          <Input id="name" name="name" defaultValue={name} disabled={!canWrite} />
        </Field>
        {canWrite ? (
          <Button
            type="submit"
            disabled={pending}
            variant="outline"
            className="justify-self-start"
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </form>
      <form
        action={async () => {
          setSigningOut(true);
          await signOutAction();
        }}
      >
        <Button type="submit" variant="ghost" disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </form>
    </div>
  );
}

/** The studio's legal identity: address, contact and registration numbers. */
export function OrgBusinessForm({
  orgSlug,
  business,
  canWrite,
}: {
  orgSlug: string;
  business: InvoiceBusiness;
  canWrite: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <form
      className="grid max-w-xl gap-4"
      action={(formData) => {
        start(async () => {
          const result = await updateOrgBusinessAction(orgSlug, formData);
          if ("error" in result && result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Business details saved");
        });
      }}
    >
      <fieldset disabled={!canWrite || pending} className="grid gap-4">
        <Field label="Legal / business name" htmlFor="org_business_legal_name">
          <Input
            id="org_business_legal_name"
            name="business_legal_name"
            defaultValue={business.legalName}
            autoComplete="organization"
          />
        </Field>
        <Field label="Address" htmlFor="org_business_address">
          <Textarea
            id="org_business_address"
            name="business_address"
            rows={3}
            defaultValue={business.address}
            className="resize-none"
            placeholder={"Street\nCity, State ZIP\nCountry"}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" htmlFor="org_business_email">
            <Input
              id="org_business_email"
              name="business_email"
              type="email"
              defaultValue={business.email}
            />
          </Field>
          <Field label="Phone" htmlFor="org_business_phone">
            <Input
              id="org_business_phone"
              name="business_phone"
              type="tel"
              defaultValue={business.phone}
            />
          </Field>
          <Field label="Tax ID" htmlFor="org_business_tax_id" hint="GSTIN, VAT, EIN…">
            <Input
              id="org_business_tax_id"
              name="business_tax_id"
              defaultValue={business.taxId}
            />
          </Field>
          <Field label="Website" htmlFor="org_business_website">
            <Input
              id="org_business_website"
              name="business_website"
              defaultValue={business.website}
            />
          </Field>
        </div>
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">More details</p>
          <p className="-mt-1 text-xs text-muted-foreground">
            Registration numbers like PAN, CIN, LUT, VAT or company number.
          </p>
          <ExtraFieldsEditor
            prefix="business_extra"
            initial={business.extras}
            suggestions={["PAN", "CIN", "LUT No.", "MSME / Udyam", "Company no."]}
          />
        </div>
      </fieldset>
      {canWrite ? (
        <Button type="submit" disabled={pending} variant="outline" className="justify-self-start">
          {pending ? "Saving…" : "Save business details"}
        </Button>
      ) : null}
    </form>
  );
}
