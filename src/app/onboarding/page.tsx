import { redirect } from "next/navigation";
import { firstOrgPath } from "@/modules/identity/org";
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
    return (
      <div className="flex min-h-svh items-center justify-center px-6">
        <div className="max-w-md">
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Almost there
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">No studio yet</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your account exists but no organization was attached. Sign out and create a new account,
            or ask an owner to invite you.
          </p>
        </div>
      </div>
    );
  }

  redirect(await firstOrgPath());
}
