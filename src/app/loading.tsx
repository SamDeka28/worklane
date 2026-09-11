import { PageSkeleton } from "@/components/page-skeleton";

export default function RootLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <PageSkeleton />
      </div>
    </div>
  );
}
