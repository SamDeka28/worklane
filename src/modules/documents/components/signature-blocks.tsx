import { cn } from "@/lib/utils";

export const SIGNATURE_FONT =
  '"Snell Roundhand", "Apple Chancery", "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive';

export type SignatureView = {
  party: "client" | "studio";
  signerName: string;
  signerEmail: string;
  signatureText: string | null;
  signedAt: string;
  contentHash: string | null;
};

/** Both parties' signatures side by side, with an empty line for whoever hasn't signed yet. */
export function SignatureBlocks({
  signatures,
  orgName,
  clientLabel = "Client",
  showPending = true,
  className,
}: {
  signatures: SignatureView[];
  orgName: string;
  clientLabel?: string;
  showPending?: boolean;
  className?: string;
}) {
  if (signatures.length === 0) return null;
  const hasClient = signatures.some((sig) => sig.party === "client");
  const hasStudio = signatures.some((sig) => sig.party === "studio");
  const ordered = [...signatures].sort((a, b) =>
    a.party === b.party ? a.signedAt.localeCompare(b.signedAt) : a.party === "client" ? -1 : 1,
  );
  const studioLabel = orgName ? `For ${orgName}` : "Your side";

  return (
    <section className={cn("grid gap-8 sm:grid-cols-2", className)}>
      {showPending && !hasClient ? <PendingSlot label={clientLabel} /> : null}
      {ordered.map((sig) => (
        <SignatureBlock
          key={`${sig.party}-${sig.signedAt}`}
          signature={sig}
          label={sig.party === "studio" ? studioLabel : clientLabel}
        />
      ))}
      {showPending && !hasStudio ? <PendingSlot label={studioLabel} /> : null}
    </section>
  );
}

function SignatureBlock({ signature, label }: { signature: SignatureView; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label} · signed electronically
      </p>
      <p
        className="mt-3 truncate border-b border-slate-300 pb-1 text-4xl leading-tight text-slate-900"
        style={{ fontFamily: SIGNATURE_FONT }}
      >
        {signature.signatureText ?? signature.signerName}
      </p>
      <div className="mt-2 grid gap-y-1 text-xs text-slate-600">
        <p className="truncate">
          <span className="text-slate-400">Name</span> {signature.signerName}
        </p>
        <p className="truncate">
          <span className="text-slate-400">Email</span> {signature.signerEmail}
        </p>
        <p>
          <span className="text-slate-400">Signed</span> {new Date(signature.signedAt).toUTCString()}
        </p>
        {signature.contentHash ? (
          <p className="truncate" title={signature.contentHash}>
            <span className="text-slate-400">Fingerprint</span> {signature.contentHash.slice(0, 24)}…
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PendingSlot({ label }: { label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-3 flex h-[3.25rem] items-end border-b border-dashed border-slate-300 pb-1 text-sm italic text-slate-400">
        Awaiting signature
      </p>
    </div>
  );
}
