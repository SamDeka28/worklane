"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOutAction, updateOrgAction } from "@/modules/identity/actions";

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
        className="grid gap-3"
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Studio name</Label>
          <Input id="name" name="name" defaultValue={name} disabled={!canWrite} />
        </div>
        {canWrite ? (
          <Button type="submit" disabled={pending} variant="outline">
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
