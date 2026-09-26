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
        subtitle="Theme and interface style for your account on every device"
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        <AppearancePicker
          saved={ctx.theme}
          savedSurface={ctx.surfaceStyle}
          savedComponent={ctx.componentStyle}
          savedInterface={ctx.interfaceStyle}
        />
      </div>
    </WorkSurface>
  );
}
