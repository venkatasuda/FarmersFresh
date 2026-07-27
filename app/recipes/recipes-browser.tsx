"use client";

import { useState, useTransition } from "react";
import { useCart } from "@/app/(shop)/cart-context";
import {
  getRecipeDetail,
  getRecipes,
  type RecipeCard,
  type RecipeDetail,
} from "./actions";
import { INDIAN_STATES, INTERNATIONAL_CUISINES } from "@/lib/cuisines";
import { formatRupees } from "@/lib/format";

/** Turn a YouTube watch / short / youtu.be link into an embeddable URL. */
function youtubeEmbed(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/
  );
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export function RecipesBrowser({
  cuisines,
  initial,
}: {
  cuisines: { cuisine: string; n: number }[];
  initial: RecipeCard[];
}) {
  const [servings, setServings] = useState(4);
  const [budget, setBudget] = useState("");
  const [diet, setDiet] = useState(""); // "", "diet", "traditional"
  const [cuisine, setCuisine] = useState("");
  const [cards, setCards] = useState<RecipeCard[]>(initial);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<RecipeDetail | null>(null);
  const [ask, setAsk] = useState("");

  // Rule-based "cook assistant": read the plain-language request and fill the
  // filters. No LLM — free & instant. This is the seam where a custom NLU model
  // could plug in later (return { servings, budget, diet, cuisine }).
  function runAsk() {
    const t = ask.toLowerCase();
    const bud =
      t.match(/(?:under|below|within|budget|₹|rs\.?)\s*(\d{2,5})/) ||
      t.match(/(\d{2,5})\s*(?:rupees|rs|₹)/);
    const srv =
      t.match(/(\d{1,2})\s*(?:people|ppl|persons?|members?)/) ||
      t.match(/(?:for|serves?)\s*(\d{1,2})/);
    const d = /\b(diet|light|healthy)\b/.test(t)
      ? "diet"
      : /\btraditional\b/.test(t)
        ? "traditional"
        : "";
    const cui =
      [...INDIAN_STATES, ...INTERNATIONAL_CUISINES].find((c) =>
        t.includes(c.toLowerCase())
      ) ?? "";

    const nextServings = srv ? Math.max(1, Number.parseInt(srv[1])) : servings;
    const nextBudget = bud ? bud[1] : budget;
    setServings(nextServings);
    setBudget(nextBudget);
    setDiet(d);
    setCuisine(cui);
    refresh({ servings: nextServings, budget: nextBudget, diet: d, cuisine: cui });
  }

  function refresh(next?: Partial<{ servings: number; budget: string; diet: string; cuisine: string }>) {
    const s = next?.servings ?? servings;
    const b = next?.budget ?? budget;
    const d = next?.diet ?? diet;
    const c = next?.cuisine ?? cuisine;
    startTransition(async () => {
      const r = await getRecipes({
        cuisine: c || undefined,
        diet: d || undefined,
        servings: s,
        maxBudget: b ? Number.parseFloat(b) : undefined,
      });
      setCards(r);
    });
  }

  function view(id: string) {
    startTransition(async () => {
      const d = await getRecipeDetail(id, servings);
      setOpen(d);
    });
  }

  return (
    <div className="space-y-5">
      {/* Cook assistant — say it in plain words. */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <label className="text-sm font-medium text-brand-900">
          What shall we cook?
        </label>
        <div className="mt-2 flex gap-2">
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runAsk();
            }}
            placeholder="e.g. veg dinner for 4 under ₹600"
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={runAsk}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Suggest
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs text-ink-soft">People</span>
            <input
              type="number"
              min="1"
              value={servings}
              onChange={(e) => {
                const v = Math.max(1, Number.parseInt(e.target.value) || 1);
                setServings(v);
                refresh({ servings: v });
              }}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-xs text-ink-soft">Budget (₹, optional)</span>
            <input
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              onBlur={() => refresh()}
              placeholder="Any"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-xs text-ink-soft">Type</span>
            <select
              value={diet}
              onChange={(e) => {
                setDiet(e.target.value);
                refresh({ diet: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="traditional">Traditional</option>
              <option value="diet">Diet</option>
            </select>
          </label>
        </div>

        {/* Cuisine — every Indian state + international, not just the ones with
            recipes, so people can explore any region. */}
        <label className="mt-3 block">
          <span className="text-xs text-ink-soft">Cuisine / state</span>
          <select
            value={cuisine}
            onChange={(e) => {
              setCuisine(e.target.value);
              refresh({ cuisine: e.target.value });
            }}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">All cuisines</option>
            <optgroup label="Indian states & styles">
              {INDIAN_STATES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </optgroup>
            <optgroup label="International">
              {INTERNATIONAL_CUISINES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </optgroup>
          </select>
          {cuisines.length > 0 ? (
            <span className="mt-1 block text-xs text-ink-soft">
              Recipes so far in: {cuisines.map((c) => c.cuisine).join(", ")}
            </span>
          ) : null}
        </label>
      </div>

      {/* Cards */}
      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-ink-soft">
          {pending ? "Finding recipes…" : "No recipes match — try a bigger budget or a different cuisine."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => view(r.id)}
              className="overflow-hidden rounded-2xl border border-line bg-surface text-left transition-colors hover:border-brand-300"
            >
              {r.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imagePath} alt="" className="h-32 w-full object-cover" />
              ) : (
                <div className="h-32 w-full bg-gradient-to-br from-brand-100 to-brand-200" />
              )}
              <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
                  {r.cuisine}
                </span>
                <span className="text-xs text-ink-soft">{r.isDiet ? "Diet" : "Traditional"}</span>
              </div>
              <p className="mt-2 font-medium text-ink">{r.name}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {r.ingredientCount} ingredients · serves {servings}
              </p>
              <p className="mt-1 text-lg font-semibold text-ink">{formatRupees(r.cost)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open ? (
        <RecipeModal detail={open} servings={servings} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}

function RecipeModal({
  detail,
  servings,
  onClose,
}: {
  detail: RecipeDetail;
  servings: number;
  onClose: () => void;
}) {
  const { add, openDrawer } = useCart();
  const [added, setAdded] = useState(false);
  const total = detail.items.reduce((s, i) => s + i.lineCost, 0);

  function addAll() {
    for (const i of detail.items) {
      add(
        {
          productId: i.productId,
          slug: i.slug,
          name: i.name,
          unit: i.unit,
          price: i.price,
          imagePath: i.imagePath,
          packLabel: null,
          step: i.unit === "kg" ? 0.5 : 1,
        },
        i.qty
      );
    }
    setAdded(true);
    onClose();
    openDrawer();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {detail.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.imagePath} alt="" className="mb-3 h-40 w-full rounded-xl object-cover" />
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-brand-700">{detail.cuisine} · {detail.isDiet ? "Diet" : "Traditional"}</p>
            <h2 className="text-xl font-semibold tracking-tight text-ink">{detail.name}</h2>
            <p className="text-sm text-ink-soft">For {servings} {servings === 1 ? "person" : "people"}</p>
          </div>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink">✕</button>
        </div>
        {detail.description ? <p className="mt-2 text-sm text-ink-soft">{detail.description}</p> : null}

        {youtubeEmbed(detail.videoUrl) ? (
          <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl">
            <iframe
              src={youtubeEmbed(detail.videoUrl)!}
              title="Recipe video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : null}

        <ul className="mt-4 divide-y divide-line">
          {detail.items.map((i) => (
            <li key={i.productId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink">
                {i.name}{" "}
                <span className="text-ink-soft">
                  {i.qty} {i.unit === "kg" ? "kg" : "×"}
                </span>
              </span>
              <span className="tabular-nums text-ink-soft">{formatRupees(i.lineCost)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="font-medium text-ink">Total ingredients</span>
          <span className="text-lg font-semibold text-ink tabular-nums">{formatRupees(total)}</span>
        </div>

        <button
          type="button"
          disabled={added || detail.items.length === 0}
          onClick={addAll}
          className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Add all ingredients to basket
        </button>
      </div>
    </div>
  );
}

