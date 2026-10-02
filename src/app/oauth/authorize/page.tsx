import { redirect } from "next/navigation";

export default async function OauthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value);
  }
  const search = params.toString();
  redirect(search ? `/connect?${search}` : "/connect");
}
