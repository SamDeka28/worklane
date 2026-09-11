/** F9 helpers — signed versions are immutable. */

export function isVersionLocked(status: string, lockedAt: string | null) {
  return Boolean(lockedAt) || status === "signed" || status === "accepted";
}

export function buildLiveSnapshot(input: {
  clientName?: string | null;
  projectName?: string | null;
  contentDoc: Record<string, unknown>;
  frozenAt: string;
}) {
  return {
    frozenAt: input.frozenAt,
    clientName: input.clientName ?? null,
    projectName: input.projectName ?? null,
    contentDoc: input.contentDoc,
  };
}

export function assertCanMutateVersion(input: {
  status: string;
  lockedAt: string | null;
}) {
  if (isVersionLocked(input.status, input.lockedAt)) {
    throw new Error("Signed or accepted versions cannot be edited");
  }
}
