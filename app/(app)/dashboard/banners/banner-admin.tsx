"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBanner, deleteBanner, toggleBanner } from "./actions";

type Row = {
  id: string;
  title: string;
  subtitle: string | null;
  href: string | null;
  bg_from: string;
  bg_to: string;
  is_active: boolean;
};

const PRESETS: { label: string; from: string; to: string }[] = [
  { label: "Green", from: "#16a34a", to: "#14532d" },
  { label: "Harvest", from: "#b45309", to: "#7c2d12" },
  { label: "Berry", from: "#9d174d", to: "#4a044e" },
  { label: "Ocean", from: "#0369a1", to: "#082f49" },
  { label: "Slate", from: "#334155", to: "#0f172a" },
];

export function BannerAdmin({ banners }: { banners: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [cta, setCta] = useState("");
  const [href, setHref] = useState("");
  const [preset, setPreset] = useState(0);

  function submit() {
    setError(null);
    startTransition(async () => {
      const p = PRESETS[preset];
      const r = await createBanner({
        title,
        subtitle,
        ctaLabel: cta,
        href,
        bgFrom: p.from,
        bgTo: p.to,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setTitle("");
      setSubtitle("");
      setCta("");
      setHref("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">New banner</h2>

        {/* Live preview */}
        <div
          className="mt-3 flex h-28 flex-col justify-center rounded-2xl px-5 text-white"
          style={{
            backgroundImage: `linear-gradient(135deg, ${PRESETS[preset].from}, ${PRESETS[preset].to})`,
          }}
        >
          <p className="text-lg font-semibold">{title || "Banner title"}</p>
          {subtitle ? <p className="text-sm text-white/90">{subtitle}</p> : null}
          {cta ? (
            <span className="mt-2 inline-block w-fit rounded-lg bg-white px-3 py-1 text-xs font-medium text-ink">
              {cta}
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={inp} />
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle" className={inp} />
          <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Button text (e.g. Shop now)" className={inp} />
          <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="Link (e.g. /collections/meat-eggs)" className={inp} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPreset(i)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                preset === i ? "border-brand-500" : "border-line"
              }`}
            >
              <span
                className="size-4 rounded"
                style={{ backgroundImage: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
              />
              {p.label}
            </button>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <button
          type="button"
          disabled={pending || !title}
          onClick={submit}
          className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add banner"}
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <h2 className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
          Your banners
        </h2>
        {banners.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">
            None yet — the storefront shows the default hero.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {banners.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="size-10 shrink-0 rounded-lg"
                  style={{ backgroundImage: `linear-gradient(135deg, ${b.bg_from}, ${b.bg_to})` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{b.title}</p>
                  {b.href ? (
                    <p className="truncate text-xs text-ink-soft">{b.href}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await toggleBanner(b.id, !b.is_active);
                      router.refresh();
                    })
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    b.is_active
                      ? "bg-brand-100 text-brand-800"
                      : "bg-zinc-100 text-ink-soft"
                  }`}
                >
                  {b.is_active ? "Live" : "Off"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteBanner(b.id);
                      router.refresh();
                    })
                  }
                  className="text-xs text-ink-soft hover:text-red-600"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const inp =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500";
