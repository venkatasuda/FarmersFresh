import Image from "next/image";
import { Leaf } from "@/app/brand";

/**
 * A product picture, or a branded placeholder when there isn't one yet.
 *
 * The placeholder is deliberately designed — a soft green tile with the leaf
 * mark and the product's initials — rather than a stock photo. A generic
 * supermarket image standing in for your actual cut is worse than an honest,
 * on-brand placeholder: it sets an expectation the delivered goods have to
 * meet, and it isn't yours to use. When a real photo is uploaded it simply
 * takes this tile's place.
 *
 * A stable hue is derived from the name so the grid looks varied rather than
 * 42 identical tiles — but stays inside the brand greens.
 */
function initials(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Small hash → 0..1, deterministic per product, for subtle tile variation.
function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return h / 997;
}

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
    const t = hue(alt);
    // Two brand-green stops, nudged by the hash so tiles differ gently.
    const from = `hsl(${140 + t * 20}, 45%, ${92 - t * 6}%)`;
    const to = `hsl(${135 + t * 15}, 40%, ${82 - t * 8}%)`;

    return (
      // absolute inset-0 so it fills any `relative` parent, with or without a
      // sizing className — every place ProductImage is used wraps it in one.
      <div
        className={`absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        role="img"
        aria-label={`${alt} — photo coming soon`}
      >
        {/* Oversized faint leaf as a watermark */}
        <span className="absolute -right-4 -bottom-4 text-brand-600/15">
          <Leaf className="size-28" />
        </span>
        <span className="relative flex flex-col items-center gap-1">
          <span className="text-2xl font-semibold text-brand-700/80">
            {initials(alt)}
          </span>
          <span className="text-[10px] font-medium tracking-wide text-brand-700/60 uppercase">
            Farmers Fresh
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
