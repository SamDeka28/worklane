import { AuthCard } from "@/components/auth/auth-card";
import { SwitchAccountCard } from "@/components/auth/switch-account-card";
import { createServerSupabaseClient } from "@/shared/db/supabase/server";
import { inviteTokenFromQuery } from "@/shared/auth/invite-params";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const inviteToken = inviteTokenFromQuery(query);
  const defaultEmail = typeof query.email === "string" ? query.email : undefined;
  const authError = typeof query.error === "string" ? query.error : undefined;
  const confirmed = query.confirmed === "1";

  if (query.switch === "1") {
    const supabase = await createServerSupabaseClient();
    const current = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (current) {
      return (
        <SwitchAccountCard
          currentEmail={current.email ?? "another account"}
          targetEmail={defaultEmail}
          inviteToken={inviteToken}
          confirmed={confirmed}
          error={authError}
        />
      );
    }
  }

  return (
    <AuthCard
      title={inviteToken ? "Sign in to accept" : "Sign in"}
      description={
        inviteToken
          ? "Use the email address on the invite."
          : "No account?"
      }
      mode="login"
      inviteToken={inviteToken}
      defaultEmail={defaultEmail}
      confirmed={confirmed}
      initialError={authError}
    />
  );
}
