import { redirect } from "next/navigation";
import { firstOrgPath } from "@/modules/identity/org";
import { claimPendingInvitationsForUser } from "@/modules/team/invites";
import { getSessionUser } from "@/shared/db/require-user";

export const metadata = {
  title: "Opening studio",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ empty?: string }>;
}) {
  const { user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const query = await searchParams;
  if (query.empty === "1") {
    const claimed = await claimPendingInvitationsForUser();
    if (claimed.length > 0) {
      const first = claimed[0];
      if (first.projectId) {
        redirect(`/${first.orgSlug}/projects/${first.projectId}?joined=1`);
      }
      redirect(`/${first.orgSlug}?joined=1`);
    }

    return (
      <div className="flex min-h-svh items-center justify-center px-6">
        <div className="max-w-md">
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Almost there
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">No studio yet</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your account exists but no organization was attached. Open the invite
            link from your email while signed in, or ask an owner to resend the invite.
          </p>
        </div>
      </div>
    );
  }

  redirect(await firstOrgPath());
}
