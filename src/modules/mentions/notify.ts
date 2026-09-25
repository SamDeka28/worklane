import type { requireOrg } from "@/modules/identity/org";
import { notify, userLabel } from "@/modules/notifications/service";

type OrgCtx = Pick<Awaited<ReturnType<typeof requireOrg>>, "org" | "userId" | "supabase">;

type MentionNode = { type?: string; attrs?: Record<string, unknown>; content?: MentionNode[] };

function collectPeople(doc: unknown) {
  const members = new Set<string>();
  const partners = new Set<string>();
  const walk = (node: MentionNode | null | undefined) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "mention") {
      const id = String(node.attrs?.id ?? "");
      const type = String(node.attrs?.type ?? "");
      if (id && type === "member") members.add(id);
      if (id && type === "partner") partners.add(id);
    }
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc as MentionNode);
  return { members, partners };
}

/** User ids of people @mentioned in a TipTap doc (partners resolve to their linked login). */
export async function mentionedUserIds(ctx: OrgCtx, doc: unknown): Promise<string[]> {
  const { members, partners } = collectPeople(doc);
  const ids = new Set(members);
  if (partners.size > 0) {
    const { data } = await ctx.supabase
      .from("partners")
      .select("user_id")
      .eq("organization_id", ctx.org.id)
      .in("id", [...partners]);
    for (const row of data ?? []) if (row.user_id) ids.add(row.user_id as string);
  }
  if (ids.size > 0) {
    const { data } = await ctx.supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", ctx.org.id)
      .eq("status", "active")
      .in("user_id", [...ids]);
    const active = new Set((data ?? []).map((row) => row.user_id as string));
    for (const id of [...ids]) if (!active.has(id)) ids.delete(id);
  }
  return [...ids];
}

/**
 * Notifies people newly @mentioned in `doc` (anyone already mentioned in `previousDoc`
 * was told last time). Returns who was notified so callers can skip duplicate pings.
 */
export async function notifyMentions(
  ctx: OrgCtx,
  input: {
    doc: unknown;
    previousDoc?: unknown;
    where: string;
    excerpt: string;
    href: string;
    entity: { type: string; id: string };
  },
): Promise<string[]> {
  try {
    const [current, previous] = await Promise.all([
      mentionedUserIds(ctx, input.doc),
      input.previousDoc ? mentionedUserIds(ctx, input.previousDoc) : Promise.resolve([]),
    ]);
    const already = new Set(previous);
    const fresh = current.filter((id) => !already.has(id) && id !== ctx.userId);
    if (fresh.length === 0) return [];
    const actor = await userLabel(ctx.userId);
    const excerpt = input.excerpt.trim();
    await notify({
      recipients: fresh,
      organizationId: ctx.org.id,
      orgName: ctx.org.name,
      category: "mentions",
      title: `${actor} mentioned you in ${input.where}`,
      body: excerpt.length > 180 ? `${excerpt.slice(0, 177)}…` : excerpt || input.where,
      href: input.href,
      actorId: ctx.userId,
      entity: input.entity,
      actionLabel: "View mention",
      ownerCopy: false,
    });
    return fresh;
  } catch (error) {
    console.error("notifyMentions failed", error);
    return [];
  }
}
