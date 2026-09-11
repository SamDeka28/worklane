import { AuthCard } from "@/components/auth/auth-card";

export const metadata = {
  title: "Create account",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const inviteToken = typeof query.invite === "string" ? query.invite : undefined;
  const defaultEmail = typeof query.email === "string" ? query.email : undefined;

  return (
    <AuthCard
      title={inviteToken ? "Join the studio" : "Create your studio"}
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
