import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";
import { AppearancePicker } from "@/modules/identity/components/appearance-picker";
import { requireOrg } from "@/modules/identity/org";

export default async function AppearancePage({
  params,
}: PageProps<"/[orgSlug]/appearance">) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);

  return (
    <WorkSurface>
      <StudioToolbar
        title="Appearance"
        subtitle="Theme for your account on every device"
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
        <AppearancePicker saved={ctx.theme} />
      </div>
    </WorkSurface>
  );
}
