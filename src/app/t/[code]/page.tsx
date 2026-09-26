import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/shared/db/require-user";
import { fromShortId } from "@/shared/short-id";

/** Short share link for a board card: resolves to the card on its project board. */
export default async function TaskShortLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const taskId = fromShortId(code);
  if (!taskId) notFound();

  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) redirect(`/login?next=${encodeURIComponent(`/t/${code}`)}`);

  const { data } = await supabase
    .from("tasks")
    .select("id, project_id, organizations ( slug )")
    .eq("id", taskId)
    .maybeSingle();

  const org = data?.organizations as { slug?: string } | { slug?: string }[] | null | undefined;
  const slug = Array.isArray(org) ? org[0]?.slug : org?.slug;
  if (!data || !slug) notFound();

  redirect(`/${slug}/projects/${data.project_id}?tab=work&panel=board&task=${data.id}`);
}
