import { AuthCard } from "@/components/auth/auth-card";
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
    />
  );
}
