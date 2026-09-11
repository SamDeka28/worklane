import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <BrandMark size={64} />
      <h1 className="font-heading mt-6 text-2xl tracking-tight">This lane does not exist</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Check the URL, or go back to the studio.
      </p>
      <Button className="mt-6" nativeButton={false} render={<Link href="/" />}>
        Home
      </Button>
    </div>
  );
}
