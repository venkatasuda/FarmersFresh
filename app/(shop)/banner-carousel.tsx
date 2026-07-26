"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Banner } from "@/lib/types";

/**
 * The homepage promo carousel — the "Mango Mania" strip Swiggy/Zepto run.
 * Auto-advances, pauses on hover, and has dots. Colour-gradient banners so a
 * campaign needs no uploaded artwork (an image_path overrides the gradient if
 * one is set).
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || banners.length < 2) return;
    const t = window.setInterval(
      () => setI((v) => (v + 1) % banners.length),
      5000
    );
    return () => window.clearInterval(t);
  }, [paused, banners.length]);

  if (banners.length === 0) return null;
  const b = banners[i];

  const inner = (
    <div
      className="relative flex h-44 flex-col justify-center overflow-hidden rounded-3xl px-6 py-6 text-white sm:h-52 sm:px-10"
      style={
        b.imagePath
          ? { backgroundImage: `url(${b.imagePath})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { backgroundImage: `linear-gradient(135deg, ${b.bgFrom}, ${b.bgTo})` }
      }
    >
      <div className="pointer-events-none absolute -top-12 -right-8 size-48 rounded-full bg-white/10 blur-2xl" />
      <div className="relative max-w-md">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {b.title}
        </h2>
        {b.subtitle ? (
          <p className="mt-1.5 text-white/90">{b.subtitle}</p>
        ) : null}
        {b.ctaLabel ? (
          <span className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink">
            {b.ctaLabel}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className="relative mb-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {b.href ? <Link href={b.href}>{inner}</Link> : inner}

      {banners.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Go to banner ${n + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? "w-5 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
