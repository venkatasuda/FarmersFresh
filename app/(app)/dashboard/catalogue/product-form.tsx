"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageUpload } from "./image-upload";
import { saveProduct, retireProduct } from "./actions";
import { formatRupees } from "@/lib/format";
import {
  PACK_UNITS,
  unitPrice,
  type AdminProduct,
  type Brand,
  type Category,
  type PackUnit,
} from "@/lib/types";

export function ProductForm({
  product,
  categories,
  brands,
}: {
  product: AdminProduct | null;
  categories: Category[];
  brands: Brand[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [brandId, setBrandId] = useState(
    product?.brandId ?? brands.find((b) => b.isPrimary)?.id ?? ""
  );
  const [price, setPrice] = useState(product?.salePrice?.toString() ?? "");
  const [wasPrice, setWasPrice] = useState(
    product?.compareAtPrice?.toString() ?? ""
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [badge, setBadge] = useState(product?.badge ?? "");
  const [imagePath, setImagePath] = useState(product?.imagePath ?? null);
  const [published, setPublished] = useState(product?.isPublished ?? false);

  // The central fork: sold loose by weight, or in packs. See migration 0008.
  const [soldLoose, setSoldLoose] = useState(product?.packSize === null);
  const [packSize, setPackSize] = useState(product?.packSize?.toString() ?? "");
  const [packUnit, setPackUnit] = useState(product?.packUnit ?? "g");

  // Only subcategories can hold products — a product in a department would
  // never appear under any of its siblings.
  const selectable = categories.filter((c) => c.parentId !== null);
  const parentOf = (c: Category) =>
    categories.find((p) => p.id === c.parentId)?.name ?? "";

  const priceNum = Number.parseFloat(price);
  const sizeNum = Number.parseFloat(packSize);
  const preview =
    !soldLoose && Number.isFinite(priceNum) && Number.isFinite(sizeNum)
      ? unitPrice({
          salePrice: priceNum,
          packSize: sizeNum,
          packUnit,
        })
      : null;

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await saveProduct({
        id: product?.id ?? null,
        name,
        categoryId: categoryId || null,
        brandId: brandId || null,
        salePrice: price === "" ? null : Number.parseFloat(price),
        compareAtPrice: wasPrice === "" ? null : Number.parseFloat(wasPrice),
        description,
        packSize: soldLoose || packSize === "" ? null : Number.parseFloat(packSize),
        packUnit: soldLoose || packSize === "" ? null : packUnit,
        badge,
        imagePath,
        isPublished: published,
        sortOrder: product?.sortOrder ?? 100,
      });

      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.push("/dashboard/catalogue");
      router.refresh();
    });
  }

  function retire() {
    setError(null);
    if (!product) return;
    startTransition(async () => {
      const r = await retireProduct(product.id, "Line discontinued");
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.push("/dashboard/catalogue");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <Field label="Name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mutton Curry Cut 1 kg"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose…</option>
              {selectable.map((c) => (
                <option key={c.id} value={c.id}>
                  {parentOf(c)} → {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Brand">
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className={inputClass}
            >
              <option value="">None</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description" hint="One or two lines. What makes it good.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">How it&apos;s sold</h2>

        <div className="flex gap-2">
          <Choice
            active={soldLoose}
            onClick={() => setSoldLoose(true)}
            title="By weight"
            body="Cut to order — customer picks 1.5 kg"
          />
          <Choice
            active={!soldLoose}
            onClick={() => setSoldLoose(false)}
            title="In packs"
            body="Fixed pack — customer picks 2 packs"
          />
        </div>

        {!soldLoose ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pack size" required>
              <input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                placeholder="500"
                className={inputClass}
              />
            </Field>
            <Field label="Unit">
              <select
                value={packUnit}
                onChange={(e) => setPackUnit(e.target.value as PackUnit)}
                className={inputClass}
              >
                {PACK_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Sold loose. The price below is per kilogram, and customers order in
            500 g steps.
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">Price</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={soldLoose ? "Price per kg (₹)" : "Price per pack (₹)"}
            required
          >
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="Was (₹)"
            hint="Optional. Must be higher than the price."
          >
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={wasPrice}
              onChange={(e) => setWasPrice(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {preview ? (
          <p className="text-sm text-ink-soft">
            Shows on the shop as{" "}
            <span className="font-medium text-ink">
              {formatRupees(preview.value)} per {preview.per}
            </span>{" "}
            — that&apos;s how customers compare pack sizes.
          </p>
        ) : null}

        <Field label="Badge" hint="Short. 'Bestseller', 'Today's cut'. Optional.">
          <input
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            maxLength={20}
            className={inputClass}
          />
        </Field>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <ImageUpload value={imagePath} onChange={setImagePath} />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="mt-0.5 size-4 accent-brand-600"
          />
          <span>
            <span className="text-sm font-medium text-ink">
              Show on the shop
            </span>
            <span className="block text-sm text-ink-soft">
              Customers can only see and order this when it&apos;s ticked and
              there&apos;s stock on hand.
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : product ? "Save changes" : "Add product"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard/catalogue")}
          className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink-soft hover:text-ink"
        >
          Cancel
        </button>

        {product ? (
          <div className="ml-auto">
            {confirmRetire ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink-soft">
                  Retire and write off {product.onHand} in stock?
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={retire}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Yes, retire
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRetire(false)}
                  className="rounded-lg border border-line px-3 py-2 text-sm text-ink-soft"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRetire(true)}
                className="text-sm text-ink-soft hover:text-red-600"
              >
                Retire product
              </button>
            )}
          </div>
        ) : null}
      </div>

      {product ? (
        <p className="text-xs text-ink-soft">
          Retiring hides a product and writes its stock to zero. It is never
          deleted — the stock ledger holds its history, and that history stays
          readable.
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500";

function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-brand-600"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

function Choice({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border px-4 py-3 text-left transition-colors ${
        active
          ? "border-brand-500 bg-brand-50"
          : "border-line hover:border-brand-300"
      }`}
    >
      <span
        className={`block text-sm font-medium ${active ? "text-brand-900" : "text-ink"}`}
      >
        {title}
      </span>
      <span className="mt-0.5 block text-xs text-ink-soft">{body}</span>
    </button>
  );
}
