import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  /** Rendered height of the W. Width follows the mark’s natural ratio. */
  size?: number;
  priority?: boolean;
};

const MARK_RATIO = 586 / 313;

export function BrandMark({ className, size = 36, priority }: BrandMarkProps) {
  const width = Math.max(1, Math.round(size * MARK_RATIO));

  return (
    <Image
      src="/brand/worklane-mark.png"
      alt="Worklane"
      width={width}
      height={size}
      priority={priority}
      className={cn("object-contain", className)}
    />
  );
}
