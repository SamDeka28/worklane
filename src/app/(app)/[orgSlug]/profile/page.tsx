import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { ProfileSettingsForm } from "@/modules/identity/components/profile-settings-form";
import { requireOrg } from "@/modules/identity/org";
import { PersonalSignatureForm } from "@/modules/email-signatures/components/signature-forms";
import { getSignatures, signatureSender } from "@/modules/email-signatures/server";

export default async function ProfilePage({
  params,
}: PageProps<"/[orgSlug]/profile">) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const display =
    ctx.user.displayName?.trim() ||
    ctx.user.email?.split("@")[0] ||
    "You";
  const signatures = ctx.canWrite ? await getSignatures(ctx.org.id, ctx.userId) : null;

  return (
    <WorkSurface variant="panel">
      <StudioToolbar
        title="Profile"
        subtitle="Your name, photo and contact details across the studio"
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-6">
        <div className="max-w-5xl">
          <ProfileSettingsForm
            orgSlug={orgSlug}
            displayName={display}
            email={ctx.user.email}
            avatarUrl={ctx.user.avatarUrl}
            role={ctx.role}
            orgName={ctx.org.name}
            details={{
              jobTitle: ctx.user.jobTitle,
              phone: ctx.user.phone,
              location: ctx.user.location,
              address: ctx.user.address,
            }}
          />
          {signatures ? (
            <section
              id="signature"
              className="mt-8 grid scroll-mt-4 items-start gap-4 border-t border-border/50 pt-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10"
            >
              <div>
                <h2 className="text-base font-semibold tracking-tight">Email signature</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Added below the lead emails and Compose emails you send. You can leave it off any single email.
                </p>
              </div>
              <PersonalSignatureForm
                orgSlug={orgSlug}
                studio={signatures.studio}
                personal={signatures.personal}
                sender={await signatureSender(ctx)}
              />
            </section>
          ) : null}
        </div>
      </div>
    </WorkSurface>
  );
}
