export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Terms</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Connecting an assistant lets it read Worklane as you. It can see only the studios you
          belong to, and only the modules your role can open. It cannot create clients, post
          charges, or send email.
        </p>
        <p>
          You can disconnect an assistant from your profile at any time. The next request then has
          to sign in again. You are responsible for the assistants you allow and for following the
          terms of the assistant&apos;s own service.
        </p>
      </div>
    </main>
  );
}
