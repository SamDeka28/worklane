import Link from "next/link";
import { SoftCard } from "@/components/studio/chrome";
import { Button } from "@/components/ui/button";
import { InviteJoinClient } from "@/app/invite/[token]/invite-join-client";
import { getInvitationByToken } from "@/modules/team/invites";
import { getSessionUser } from "@/shared/db/require-user";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInvitationByToken(token);

  if (!invite || !invite.org) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        <h1 className="font-heading text-2xl font-semibold">Invite unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite link is invalid or was revoked.
        </p>
        <Button nativeButton={false} render={<Link href="/login" />} className="mt-6">
          Sign in
        </Button>
      </main>
    );
  }

  const { user } = await getSessionUser();

  if (!user) {
    const signup = `/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invite.email)}`;
    const login = `/login?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invite.email)}`;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Worklane invite
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
          Join {invite.org.name}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You&apos;re invited as <span className="capitalize">{invite.role}</span> ·{" "}
          {invite.email}
        </p>
        <SoftCard className="mt-8 grid gap-3 p-5">
          <Button nativeButton={false} render={<Link href={signup} />} size="lg">
            Create account & accept
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={login} />}
            variant="outline"
            size="lg"
          >
            Sign in & accept
          </Button>
        </SoftCard>
      </main>
    );
  }

  // Accept + navigate from the client — never mutate/redirect during RSC render.
  return (
    <InviteJoinClient
      token={token}
      orgName={invite.org.name}
      signedInEmail={user.email ?? null}
    />
  );
}
