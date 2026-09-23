"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { AvatarMark } from "@/components/studio/avatar-mark";
import { Field } from "@/components/studio/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}: {
  orgSlug: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <AvatarMark name={displayName} src={avatarUrl} size="lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Profile photo</p>
          <p className="text-xs text-muted-foreground">
            Google photos sync on sign-in. Upload a square image under 5 MB.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="size-3.5" />
              {avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {avatarUrl ? (
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
                    router.refresh();
                  });
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
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
                router.refresh();
              });
            }}
          />
        </div>
      </div>

      <form
        className="space-y-4"
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
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
