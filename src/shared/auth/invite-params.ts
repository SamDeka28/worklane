/** Derive invite token from `invite=` or `next=/invite/{token}`. */
export function inviteTokenFromQuery(
  query: Record<string, string | string[] | undefined>,
): string | undefined {
  const invite = typeof query.invite === "string" ? query.invite : undefined;
  if (invite && /^[A-Za-z0-9_-]+$/.test(invite)) {
    return invite;
  }
  const next = typeof query.next === "string" ? query.next : undefined;
  if (!next?.startsWith("/invite/")) return undefined;
  const token = next.slice("/invite/".length).split(/[/?#]/)[0];
  if (token && /^[A-Za-z0-9_-]+$/.test(token)) {
    return token;
  }
  return undefined;
}
