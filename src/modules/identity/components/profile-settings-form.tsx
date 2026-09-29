"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { AvatarMark } from "@/components/studio/avatar-mark";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  removeAvatarAction,
  updateProfileAction,
  uploadAvatarAction,
} from "@/modules/identity/actions";

export function ProfileSettingsForm({
  orgSlug,
  displayName,
  email,
  avatarUrl,
  role,
  orgName,
  details,
}: {
  orgSlug: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  orgName: string;
  details: {
    jobTitle: string | null;
    phone: string | null;
    location: string | null;
    address: string | null;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
      <aside className="flex flex-col items-center gap-4 rounded-2xl bg-muted/40 p-6 text-center ring-1 ring-foreground/5">
        <AvatarMark name={displayName} src={currentAvatarUrl} size="lg" className="size-20 text-2xl" />
        <div className="min-w-0 max-w-full">
          <p className="truncate text-base font-semibold tracking-tight">{displayName}</p>
          {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="capitalize">{role}</span> · {orgName}
          </p>
        </div>
        <div className="w-full space-y-2 border-t border-border/60 pt-4">
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-3.5" />
              {currentAvatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {currentAvatarUrl ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await removeAvatarAction(orgSlug);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Photo removed");
                    setCurrentAvatarUrl(null);
                    router.refresh();
                  });
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            Google photos sync on sign-in. Square image under 5 MB.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              start(async () => {
                const fd = new FormData();
                fd.set("file", file);
                const result = await uploadAvatarAction(orgSlug, fd);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Photo updated");
                setCurrentAvatarUrl(result.avatarUrl ?? null);
                router.refresh();
              });
            }}
          />
        </div>
      </aside>

      <form
        className="grid gap-x-5 gap-y-4 sm:grid-cols-2"
        action={(formData) => {
          start(async () => {
            const result = await updateProfileAction(orgSlug, formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Profile saved");
            router.refresh();
          });
        }}
      >
        <Field label="Display name" htmlFor="display_name">
          <Input
            id="display_name"
            name="display_name"
            required
            defaultValue={displayName}
            maxLength={80}
            className="rounded-2xl"
          />
        </Field>
        <Field label="Email" htmlFor="email" hint="Managed by your sign-in provider">
          <Input
            id="email"
            value={email ?? ""}
            disabled
            readOnly
            className="rounded-2xl"
          />
        </Field>
          <Field label="Job title" htmlFor="job_title">
            <Input
              id="job_title"
              name="job_title"
              defaultValue={details.jobTitle ?? ""}
              maxLength={80}
              placeholder="Designer, Project lead…"
              className="rounded-2xl"
            />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={details.phone ?? ""}
              maxLength={40}
              className="rounded-2xl"
            />
          </Field>
        <Field
          label="Location"
          htmlFor="location"
          hint="City and country, shown on the team page"
          className="sm:col-span-2"
        >
          <Input
            id="location"
            name="location"
            defaultValue={details.location ?? ""}
            maxLength={120}
            placeholder="Bengaluru, India"
            className="rounded-2xl"
          />
        </Field>
        <Field
          label="Mailing address"
          htmlFor="address"
          hint="Optional. Teammates in your studios can see your profile details."
          className="sm:col-span-2"
        >
          <Textarea
            id="address"
            name="address"
            rows={3}
            defaultValue={details.address ?? ""}
            maxLength={500}
            className="rounded-2xl"
          />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
