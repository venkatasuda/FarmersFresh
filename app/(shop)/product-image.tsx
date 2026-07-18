import Image from "next/image";
import { Leaf } from "@/app/brand";

/**
 * A product picture, or an honest placeholder when there isn't one yet.
 *
 * Deliberately NOT a stock photo fallback. A generic supermarket image
 * standing in for your actual cut is worse than no image — it sets an
 * expectation the delivered meat has to live up to.
 */
export function ProductImage({
  src,
  alt,
  priority = false,
  className = "",
}: {
  src: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-brand-50 ${className}`}
        role="img"
        aria-label={`${alt} — photo coming soon`}
      >
        <span className="flex flex-col items-center gap-1 text-brand-300">
          <Leaf className="size-8" />
          <span className="text-[10px] font-medium tracking-wide uppercase">
            Photo soon
          </span>
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      quality={90}
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
      className={`object-cover ${className}`}
    />
  );
}
