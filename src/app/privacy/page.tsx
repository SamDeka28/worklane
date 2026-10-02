export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Privacy</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          When you connect an assistant, Worklane reads the studios you already belong to and
          returns what that assistant asks for: studio names, clients and their primary contact,
          project status, invoices, and leads.
        </p>
        <p>
          Invoice amounts and project money are included only when your studio role can see
          finance. Worklane does not send passwords, mailbox contents, or files.
        </p>
        <p>
          The read happens when the assistant asks. Worklane does not keep a separate copy for the
          assistant. Disconnecting an assistant from your profile stops further reads. The
          assistant&apos;s own product then handles anything it already received, under that
          product&apos;s privacy policy.
        </p>
      </div>
    </main>
  );
}
