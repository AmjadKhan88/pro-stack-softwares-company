import Image from "next/image";
import type { PublicImage } from "@/features/content/types";

/** A library image at its true proportions, optimized and resized by Next.js. */
export function ContentImage({ image }: { image: PublicImage }) {
  return (
    <div className="bg-surface-muted overflow-hidden rounded-xl">
      <Image
        src={image.url}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes="(min-width: 1024px) 768px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );
}
