"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import { formatRupees } from "@/lib/format";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  receivePurchaseOrder,
  saveSupplier,
  setSupplierActive,
  type PoDetail,
  type PoSummary,
  type ProcurementOverview,
  type Supplier,
} from "./actions";

type ProductOpt = { id: string; name: string; unit: "kg" | "piece" };
type Line = { productId: string; qty: string; unitCost: string };

const STATUS_STYLE: Record<PoSummary["status"], string> = {
  draft: "bg-ink/10 text-ink",
  ordered: "bg-amber-100 text-amber-900",
  received: "bg-brand-100 text-brand-800",
  cancelled: "bg-red-100 text-red-700",
};

export function PurchasingClient({
  initialSuppliers,
  initialOrders,
  overview,
  products,
  locationId,
}: {
  initialSuppliers: Supplier[];
  initialOrders: PoSummary[];
  overview: ProcurementOverview;
  products: ProductOpt[];
  locationId: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"orders" | "suppliers">("orders");
  const activeSuppliers = initialSuppliers.filter((s) => s.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Purchasing</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Order stock from suppliers and receive it into the shop. Receiving adds
          stock and records what you paid, so margins and wastage stay honest.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Open orders" value={String(overview.openPos)} />
        <Kpi label="Active suppliers" value={String(overview.suppliers)} />
        <Link href="/dashboard/wastage" className="block">
          <Kpi
            label="Wastage (30 days)"
            value={formatRupees(overview.wastageValue30d)}
            hint="View wastage →"
          />
        </Link>
      </div>

      {!locationId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No dispatch store is set, so received stock has nowhere to land. Set the
          storefront location first.
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-line">
        <Tab active={tab === "orders"} onClick={() => setTab("orders")}>
          Purchase orders
        </Tab>
        <Tab active={tab === "suppliers"} onClick={() => setTab("suppliers")}>
          Suppliers
        </Tab>
      </div>

      {tab === "orders" ? (
        <OrdersTab
          orders={initialOrders}
          suppliers={activeSuppliers}
          products={products}
          locationId={locationId}
          onChanged={() => router.refresh()}
        />
      ) : (
        <SuppliersTab
          suppliers={initialSuppliers}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-brand-700">{hint}</p> : null}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Orders */

function OrdersTab({
  orders,
  suppliers,
  products,
  locationId,
  onChanged,
}: {
  orders: PoSummary[];
  suppliers: Supplier[];
  products: ProductOpt[];
  locationId: string | null;
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<PoDetail | null>(null);
  const [pending, startTransition] = useTransition();

  function openReceive(poId: string) {
    startTransition(async () => {
      const detail = await getPurchaseOrder(poId);
      if (detail) setReceiving(detail);
    });
  }

  function cancel(poId: string) {
    if (!confirm("Cancel this purchase order?")) return;
    startTransition(async () => {
      await cancelPurchaseOrder(poId);
      onChanged();
    });
  }

  return (
    <div className="space-y-4">
      {!creating ? (
        <button
          type="button"
          disabled={!locationId || products.length === 0}
          onClick={() => setCreating(true)}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          + New purchase order
        </button>
      ) : (
        <NewOrderForm
          suppliers={suppliers}
          products={products}
          locationId={locationId!}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            onChanged();
          }}
        />
      )}

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-ink-soft">
          No purchase orders yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <div>
                <p className="font-medium text-ink">
                  {o.poNumber}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.status]}`}
                  >
                    {o.status}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {o.supplier ?? "No supplier"} · {o.itemCount} item
                  {o.itemCount === 1 ? "" : "s"} · {formatRupees(o.totalCost)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {o.status === "draft" || o.status === "ordered" ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openReceive(o.id)}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      Receive
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => cancel(o.id)}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-red-300 hover:text-red-600"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-ink-soft">
                    {o.status === "received" ? "Received" : "Closed"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {receiving ? (
        <ReceiveModal
          detail={receiving}
          onClose={() => setReceiving(null)}
          onDone={() => {
            setReceiving(null);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function NewOrderForm({
  suppliers,
  products,
  locationId,
  onClose,
  onSaved,
}: {
  suppliers: Supplier[];
  products: ProductOpt[];
  locationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { productId: products[0]?.id ?? "", qty: "", unitCost: "" },
  ]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = lines.reduce(
    (s, l) => s + (Number.parseFloat(l.qty) || 0) * (Number.parseFloat(l.unitCost) || 0),
    0
  );

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit(markOrdered: boolean) {
    setError(null);
    const items = lines
      .map((l) => ({
        productId: l.productId,
        qty: Number.parseFloat(l.qty) || 0,
        unitCost: Number.parseFloat(l.unitCost) || 0,
      }))
      .filter((l) => l.productId && l.qty > 0);
    if (items.length === 0) {
      setError("Add at least one item with a quantity.");
      return;
    }
    startTransition(async () => {
      const r = await createPurchaseOrder({
        locationId,
        supplierId: supplierId || null,
        notes,
        items,
        markOrdered,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">New purchase order</h2>
        <button type="button" onClick={onClose} className="text-sm text-ink-soft hover:text-ink">
          ✕
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-soft">Supplier</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-soft">Notes (optional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_5rem_6rem_auto] items-end gap-2">
            <label className="block">
              {i === 0 ? <span className="text-xs text-ink-soft">Product</span> : null}
              <select
                value={l.productId}
                onChange={(e) => setLine(i, { productId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {i === 0 ? <span className="text-xs text-ink-soft">Qty</span> : null}
              <input
                type="number"
                min="0"
                step="0.5"
                value={l.qty}
                onChange={(e) => setLine(i, { qty: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              {i === 0 ? <span className="text-xs text-ink-soft">Cost/unit ₹</span> : null}
              <input
                type="number"
                min="0"
                step="1"
                value={l.unitCost}
                onChange={(e) => setLine(i, { unitCost: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm tabular-nums"
              />
            </label>
            <button
              type="button"
              onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls))}
              className="rounded-lg px-2 py-2 text-ink-soft hover:text-red-600"
              aria-label="Remove line"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setLines((ls) => [...ls, { productId: products[0]?.id ?? "", qty: "", unitCost: "" }])
          }
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          + Add item
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="text-sm text-ink-soft">Order total</span>
        <span className="text-lg font-semibold text-ink tabular-nums">
          {formatRupees(total)}
        </span>
      </div>

      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Place order"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(false)}
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:border-brand-300"
        >
          Save as draft
        </button>
      </div>
    </div>
  );
}

function ReceiveModal({
  detail,
  onClose,
  onDone,
}: {
  detail: PoDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const [qtys, setQtys] = useState<Record<string, string>>(
    Object.fromEntries(detail.items.map((i) => [i.id, String(i.qtyOrdered)]))
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const items = detail.items
      .map((i) => ({ itemId: i.id, qty: Number.parseFloat(qtys[i.id] ?? "0") || 0 }))
      .filter((i) => i.qty > 0);
    if (items.length === 0) {
      setError("Enter at least one received quantity.");
      return;
    }
    startTransition(async () => {
      const r = await receivePurchaseOrder(detail.id, items);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-ink">Receive {detail.poNumber}</h2>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Confirm what actually arrived. This adds stock and records the cost.
        </p>

        <ul className="mt-4 space-y-2">
          {detail.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink">{i.productName}</p>
                <p className="text-xs text-ink-soft">
                  Ordered {i.qtyOrdered} @ {formatRupees(i.unitCost)}
                </p>
              </div>
              <input
                type="number"
                min="0"
                step="0.5"
                value={qtys[i.id] ?? ""}
                onChange={(e) => setQtys((q) => ({ ...q, [i.id]: e.target.value }))}
                className="w-24 rounded-lg border border-line bg-surface px-2 py-2 text-sm tabular-nums"
              />
            </li>
          ))}
        </ul>

        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}

        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Receiving…" : "Confirm & add to stock"}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Suppliers */

function SuppliersTab({
  suppliers,
  onChanged,
}: {
  suppliers: Supplier[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(s: Supplier) {
    startTransition(async () => {
      await setSupplierActive(s.id, !s.isActive);
      onChanged();
    });
  }

  return (
    <div className="space-y-4">
      {adding || editing ? (
        <SupplierForm
          initial={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            onChanged();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add supplier
        </button>
      )}

      {suppliers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-ink-soft">
          No suppliers yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {suppliers.map((s) => (
            <li
              key={s.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 ${
                s.isActive ? "" : "opacity-60"
              }`}
            >
              <div>
                <p className="font-medium text-ink">{s.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {[s.contactName, s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand-300 hover:text-brand-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(s)}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand-300"
                >
                  {s.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SupplierForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    startTransition(async () => {
      const r = await saveSupplier({
        id: initial?.id ?? null,
        name,
        contactName,
        phone,
        email,
        address,
        notes,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onSaved();
    });
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          {initial ? "Edit supplier" : "New supplier"}
        </h2>
        <button type="button" onClick={onClose} className="text-sm text-ink-soft hover:text-ink">
          ✕
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <TextField label="Name *" value={name} onChange={setName} />
        <TextField label="Contact person" value={contactName} onChange={setContactName} />
        <TextField label="Phone" value={phone} onChange={setPhone} />
        <TextField label="Email" value={email} onChange={setEmail} />
        <TextField label="Address" value={address} onChange={setAddress} />
        <TextField label="Notes" value={notes} onChange={setNotes} />
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save supplier"}
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-soft">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
    </label>
  );
}
