import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { ProfileSettingsForm } from "@/modules/identity/components/profile-settings-form";
import { requireOrg } from "@/modules/identity/org";

export default async function ProfilePage({
  params,
}: PageProps<"/[orgSlug]/profile">) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const display =
    ctx.user.displayName?.trim() ||
    ctx.user.email?.split("@")[0] ||
    "You";

  return (
    <WorkSurface>
      <StudioToolbar
        title="Profile"
        subtitle="Your name, photo and contact details across the studio"
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
        <div className="mx-auto max-w-xl">
          <ProfileSettingsForm
            orgSlug={orgSlug}
            displayName={display}
            email={ctx.user.email}
            avatarUrl={ctx.user.avatarUrl}
            details={{
              jobTitle: ctx.user.jobTitle,
              phone: ctx.user.phone,
              location: ctx.user.location,
              address: ctx.user.address,
            }}
          />
        </div>
      </div>
    </WorkSurface>
  );
}
