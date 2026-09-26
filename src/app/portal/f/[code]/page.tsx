import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadIntakeForm } from "@/modules/crm/components/lead-intake-form";
import { createServerSupabaseClient } from "@/shared/db/supabase/server";

export const metadata: Metadata = {
  title: "Get in touch",
  robots: { index: false, follow: false },
};

type IntakeConfig = {
  orgName: string;
  currency: string;
  headline: string | null;
  intro: string | null;
  askCompany: boolean;
  askPhone: boolean;
  askBudget: boolean;
};

export default async function LeadIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const embed = (await searchParams).embed === "1";
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();

  const { data } = await supabase.rpc("get_lead_intake", { p_code: code });
  const config = data as IntakeConfig | null;
  if (!config) notFound();

  return (
    <main className={embed ? "p-4" : "flex min-h-svh items-start justify-center px-4 py-12 sm:py-20"}>
      <LeadIntakeForm
        code={code}
        embed={embed}
        orgName={config.orgName}
        currency={config.currency === "INR" ? "INR" : "USD"}
        headline={config.headline?.trim() || `Work with ${config.orgName}`}
        intro={
          config.intro?.trim() ||
          "Tell us a little about what you need. We usually reply within one working day."
        }
        askCompany={config.askCompany}
        askPhone={config.askPhone}
        askBudget={config.askBudget}
      />
    </main>
  );
}
