import { AuthCard } from "@/components/auth/auth-card";
import { inviteTokenFromQuery } from "@/shared/auth/invite-params";

export const metadata = {
  title: "Create account",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const inviteToken = inviteTokenFromQuery(query);
  const defaultEmail = typeof query.email === "string" ? query.email : undefined;

  return (
    <AuthCard
      title={inviteToken ? "Join the studio" : "Create an account"}
      description={
        inviteToken
          ? "Create an account with the invited email. You won’t get a separate studio."
          : "One organization to start. You can belong to more than one later."
      }
      mode="signup"
      inviteToken={inviteToken}
      defaultEmail={defaultEmail}
    />
  );
}
