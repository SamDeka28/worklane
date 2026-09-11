import Link from "next/link";
import { StudioToolbar, WorkSurface } from "@/components/studio/chrome";

type EmptyModulePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  actionHref: string;
};

export function EmptyModulePage({
  eyebrow,
  title,
  description,
  actionHref,
}: EmptyModulePageProps) {
  return (
    <WorkSurface>
      <StudioToolbar title={eyebrow} />
      <div className="flex max-w-lg flex-col gap-2 px-6 py-10">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        <Link href={actionHref} prefetch className="mt-3 w-fit text-sm text-primary hover:underline">
          Back to home
        </Link>
      </div>
    </WorkSurface>
  );
}
