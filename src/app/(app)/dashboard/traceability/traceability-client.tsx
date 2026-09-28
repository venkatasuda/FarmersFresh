"use client";

import { useState, useTransition } from "react";
import {
  addBatch,
  addFarm,
  recallTrace,
  type Batch,
  type Farm,
  type RecallRow,
} from "./actions";

type Product = { id: string; name: string };

export function TraceabilityClient({
  farms,
  batches,
  products,
}: {
  farms: Farm[];
  batches: Batch[];
  products: Product[];
}) {
  return (
    <div className="space-y-8">
      <RecallTool products={products} />
      <BatchSection farms={farms} products={products} batches={batches} />
      <FarmSection farms={farms} />
    </div>
  );
}

/* ---------- Recall lookup ---------- */
function RecallTool({ products }: { products: Product[] }) {
  const [product, setProduct] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<RecallRow[] | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!product) return;
    startTransition(async () => setRows(await recallTrace(product, from, to)));
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Recall lookup</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        If a batch is affected, find every customer who received that product in
        a date range — so you can reach them.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Select label="Product" value={product} onChange={setProduct} options={products} />
        <Field label="From" type="date" value={from} onChange={setFrom} />
        <Field label="To" type="date" value={to} onChange={setTo} />
        <button
          type="button"
          disabled={pending || !product}
          onClick={run}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Tracing…" : "Trace"}
        </button>
      </div>

      {rows ? (
        rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No orders matched.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="py-1.5 font-normal">Order</th>
                  <th className="py-1.5 font-normal">Customer</th>
                  <th className="py-1.5 font-normal">Phone</th>
                  <th className="py-1.5 font-normal">When</th>
                  <th className="py-1.5 text-right font-normal">Qty</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="py-1.5 text-ink">{r.orderNumber}</td>
                    <td className="py-1.5 text-ink">{r.contactName}</td>
                    <td className="py-1.5 text-ink-soft">
                      <a href={`tel:${r.contactPhone}`} className="hover:text-brand-700">
                        {r.contactPhone}
                      </a>
                    </td>
                    <td className="py-1.5 text-ink-soft">
                      {new Date(r.placedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-ink">{r.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-soft">
              {rows.length} order{rows.length === 1 ? "" : "s"} affected.
            </p>
          </div>
        )
      ) : null}
    </section>
  );
}

/* ---------- Batches ---------- */
function BatchSection({
  farms,
  products,
  batches,
}: {
  farms: Farm[];
  products: Product[];
  batches: Batch[];
}) {
  const [form, setForm] = useState({
    productId: "",
    farmId: "",
    batchCode: "",
    sourceDate: "",
    quantity: "",
    notes: "",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  function submit() {
    setError(null);
    if (!form.productId || !form.batchCode.trim()) {
      setError("Pick a product and enter a batch code.");
      return;
    }
    startTransition(async () => {
      const r = await addBatch(form);
      if (r.ok) {
        setSaved(true);
        setForm({ productId: "", farmId: "", batchCode: "", sourceDate: "", quantity: "", notes: "" });
      } else setError(r.message ?? "Couldn't save.");
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Stock batches</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        Log each intake with its source farm, batch code and harvest/cut date.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Select label="Product" value={form.productId} onChange={(v) => set("productId", v)} options={products} />
        <Select
          label="Farm"
          value={form.farmId}
          onChange={(v) => set("farmId", v)}
          options={farms.map((f) => ({ id: f.id, name: f.name }))}
          allowEmpty
        />
        <Field label="Batch code" value={form.batchCode} onChange={(v) => set("batchCode", v)} />
        <Field label="Harvest / cut date" type="date" value={form.sourceDate} onChange={(v) => set("sourceDate", v)} />
        <Field label="Quantity" type="number" value={form.quantity} onChange={(v) => set("quantity", v)} />
        <Field label="Notes" value={form.notes} onChange={(v) => set("notes", v)} />
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Log batch"}
        </button>
        {saved ? <span className="text-sm text-brand-700">Saved ✓</span> : null}
      </div>

      {batches.length > 0 ? (
        <div className="mt-4 overflow-x-auto border-t border-line pt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft">
                <th className="py-1.5 font-normal">Product</th>
                <th className="py-1.5 font-normal">Farm</th>
                <th className="py-1.5 font-normal">Batch</th>
                <th className="py-1.5 font-normal">Source date</th>
                <th className="py-1.5 text-right font-normal">Qty</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-line/60">
                  <td className="py-1.5 text-ink">{b.productName}</td>
                  <td className="py-1.5 text-ink-soft">{b.farmName ?? "—"}</td>
                  <td className="py-1.5 font-mono text-xs text-ink">{b.batchCode}</td>
                  <td className="py-1.5 text-ink-soft">{b.sourceDate ?? "—"}</td>
                  <td className="py-1.5 text-right tabular-nums text-ink">{b.quantity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- Farms ---------- */
function FarmSection({ farms }: { farms: Farm[] }) {
  const [form, setForm] = useState({ name: "", location: "", kind: "own", contact: "", notes: "" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function submit() {
    setError(null);
    if (!form.name.trim()) {
      setError("A farm needs a name.");
      return;
    }
    startTransition(async () => {
      const r = await addFarm(form);
      if (r.ok) setForm({ name: "", location: "", kind: "own", contact: "", notes: "" });
      else setError(r.message ?? "Couldn't save.");
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Source farms</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="Name" value={form.name} onChange={(v) => set("name", v)} />
        <Field label="Location" value={form.location} onChange={(v) => set("location", v)} />
        <label className="block">
          <span className="text-xs text-ink-soft">Type</span>
          <select
            value={form.kind}
            onChange={(e) => set("kind", e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="own">Own farm</option>
            <option value="partner">Partner farm</option>
          </select>
        </label>
        <Field label="Contact" value={form.contact} onChange={(v) => set("contact", v)} />
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add farm"}
      </button>

      {farms.length > 0 ? (
        <ul className="mt-4 divide-y divide-line border-t border-line pt-2">
          {farms.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-ink">
                {f.name}
                {f.location ? <span className="text-ink-soft"> · {f.location}</span> : null}
              </span>
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-soft capitalize">
                {f.kind}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* ---------- small inputs ---------- */
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-soft">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  allowEmpty?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-soft">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      >
        <option value="">{allowEmpty ? "— none —" : "Choose…"}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
