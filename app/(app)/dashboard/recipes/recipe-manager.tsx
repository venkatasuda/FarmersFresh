"use client";

import { useState, useTransition } from "react";
import {
  addRecipeItem,
  createRecipe,
  setRecipeImage,
  setRecipeVideo,
  type AdminRecipe,
} from "./actions";
import { ImageUpload } from "@/app/(app)/dashboard/catalogue/image-upload";
import { ALL_CUISINES as CUISINES } from "@/lib/cuisines";

type Product = { id: string; name: string };

export function RecipeManager({
  recipes,
  products,
}: {
  recipes: AdminRecipe[];
  products: Product[];
}) {
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState(CUISINES[0]);
  const [isDiet, setIsDiet] = useState(false);
  const [servings, setServings] = useState("4");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeRecipe, setActiveRecipe] = useState<{ id: string; name: string } | null>(null);

  function create() {
    setError(null);
    if (!name.trim()) {
      setError("Enter a recipe name.");
      return;
    }
    startTransition(async () => {
      const r = await createRecipe({
        name,
        cuisine,
        isDiet,
        servings: Number.parseInt(servings) || 4,
        description,
      });
      if (r.ok && r.id) {
        setActiveRecipe({ id: r.id, name });
        setName("");
        setDescription("");
      } else setError(r.message ?? "Couldn't create.");
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">New recipe</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dish name (e.g. Butter Chicken)" className={inp} />
          <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className={inp}>
            {CUISINES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="Base servings" className={inp} />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={isDiet} onChange={(e) => setIsDiet(e.target.checked)} className="size-4 accent-brand-600" />
            Diet recipe (lighter)
          </label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" className={`${inp} sm:col-span-2`} />
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <button type="button" disabled={pending} onClick={create} className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? "Creating…" : "Create recipe"}
        </button>
      </section>

      {activeRecipe ? (
        <IngredientAdder recipe={activeRecipe} products={products} onDone={() => setActiveRecipe(null)} />
      ) : null}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-2 text-sm font-medium text-ink">Your recipes</h2>
        {recipes.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">No recipes yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recipes.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-ink">
                  {r.name}{" "}
                  <span className="text-ink-soft">· {r.cuisine} · serves {r.servings} · {r.itemCount} ingredients</span>
                </span>
                <button type="button" onClick={() => setActiveRecipe({ id: r.id, name: r.name })} className="text-brand-700 hover:underline">
                  Add ingredients
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function IngredientAdder({
  recipe,
  products,
  onDone,
}: {
  recipe: { id: string; name: string };
  products: Product[];
  onDone: () => void;
}) {
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    setMsg(null);
    if (!product || !(Number.parseFloat(qty) > 0)) {
      setError("Pick a product and a quantity.");
      return;
    }
    startTransition(async () => {
      const r = await addRecipeItem(recipe.id, product, Number.parseFloat(qty));
      if (r.ok) {
        setMsg("Added ✓");
        setQty("");
      } else setError(r.message ?? "Couldn't add.");
    });
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-brand-900">Ingredients for “{recipe.name}”</h2>
        <button type="button" onClick={onDone} className="text-xs text-ink-soft hover:text-ink">Done</button>
      </div>
      <p className="mt-0.5 text-xs text-brand-700">Quantity is the amount for the recipe&apos;s base servings.</p>

      <div className="mt-3">
        <ImageUpload value={null} onChange={(p) => void setRecipeImage(recipe.id, p)} />
      </div>

      <label className="mt-3 block">
        <span className="text-xs text-brand-700">YouTube video link (your channel)</span>
        <input
          defaultValue=""
          placeholder="https://youtu.be/…"
          onBlur={(e) => void setRecipeVideo(recipe.id, e.target.value.trim())}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <select value={product} onChange={(e) => setProduct(e.target.value)} className={inp}>
          <option value="">Choose product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input type="number" min="0" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" className="w-24 rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums" />
        <button type="button" disabled={pending} onClick={add} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? "…" : "Add ingredient"}
        </button>
        {msg ? <span className="text-sm text-brand-700">{msg}</span> : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

const inp =
  "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-500";
