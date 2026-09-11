import { AuthCard } from "@/components/auth/auth-card";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const inviteToken = typeof query.invite === "string" ? query.invite : undefined;
  const defaultEmail = typeof query.email === "string" ? query.email : undefined;

  return (
    <AuthCard
      title={inviteToken ? "Sign in to accept" : "Sign in"}
      description={
        inviteToken
          ? "Use the email address on the invite."
          : "Internal operating system. Clients and partners do not need accounts."
      }
      mode="login"
      inviteToken={inviteToken}
      defaultEmail={defaultEmail}
    />
  );
}
