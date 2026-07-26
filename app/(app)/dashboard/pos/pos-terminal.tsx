"use client";

import { useMemo, useState, useTransition } from "react";
import {
  findOrCreateCustomer,
  lookupLoyalty,
  recordSale,
  type LoyaltyMember,
  type SaleLine,
} from "./actions";
import { formatRupees } from "@/lib/format";
import { packLabel, type PosProduct } from "@/lib/types";

type CartLine = SaleLine & {
  name: string;
  unit: "kg" | "piece";
  loose: boolean;
};

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
];

export function PosTerminal({
  products,
  locationId,
}: {
  products: PosProduct[];
  locationId: string;
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [onCredit, setOnCredit] = useState(false);

  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");

  // Loyalty: the scanned member, plus how many points to spend on this sale.
  const [loyaltyCode, setLoyaltyCode] = useState("");
  const [member, setMember] = useState<
    Extract<LoyaltyMember, { found: true }> | null
  >(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [loyaltyMsg, setLoyaltyMsg] = useState<string | null>(null);
  const [redeem, setRedeem] = useState("");

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    total: number;
    change: number;
    redeemed: number;
    earned: number;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
    );
  }, [products, query]);

  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    [cart]
  );

  function addProduct(p: PosProduct) {
    setDone(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      const stepQty = p.packSize === null ? 0.5 : 1;
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id
            ? { ...l, quantity: round3(l.quantity + stepQty) }
            : l
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          unit: p.unit,
          loose: p.packSize === null,
          quantity: stepQty,
          unitPrice: p.salePrice,
        },
      ];
    });
  }

  function setLine(id: string, patch: Partial<CartLine>) {
    setCart((prev) =>
      prev.map((l) => (l.productId === id ? { ...l, ...patch } : l))
    );
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.productId !== id));
  }

  function reset() {
    setCart([]);
    setTendered("");
    setOnCredit(false);
    setCustName("");
    setCustPhone("");
    setMethod("cash");
    setMember(null);
    setLoyaltyCode("");
    setRedeem("");
    setLoyaltyMsg(null);
  }

  function findMember() {
    const code = loyaltyCode.trim();
    if (!code) return;
    setLoyaltyMsg(null);
    setLookingUp(true);
    lookupLoyalty(code)
      .then((m) => {
        if (m.found) {
          setMember(m);
          setLoyaltyMsg(null);
        } else {
          setMember(null);
          setLoyaltyMsg("No loyalty card found for that code.");
        }
      })
      .finally(() => setLookingUp(false));
  }

  function completeSale() {
    setError(null);
    setDone(null);

    startTransition(async () => {
      let customerId: string | null = null;

      // Credit or part-payment needs a customer to carry the balance.
      const paid = onCredit ? 0 : Number.parseFloat(tendered || "0");
      if ((onCredit || paid < owed) && (custName || custPhone)) {
        const c = await findOrCreateCustomer(locationId, custName, custPhone);
        if (!c.ok) {
          setError(c.message);
          return;
        }
        customerId = c.id;
      }

      const r = await recordSale({
        locationId,
        customerId,
        lines: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        method,
        amountPaid: paid,
        note: "",
        loyaltyUser: member?.userId ?? null,
        pointsRedeem: redeemApplied,
      });

      if (!r.ok) {
        setError(r.message);
        return;
      }

      setDone({
        total: r.total,
        change: r.change,
        redeemed: redeemApplied,
        earned: member ? Math.floor(owed / 100) : 0,
      });
      reset();
    });
  }

  // Points spent on this sale (1 point = ₹1), capped at the balance and total.
  const redeemApplied = member
    ? Math.min(
        Math.max(0, Math.floor(Number.parseFloat(redeem || "0")) || 0),
        Math.floor(member.points),
        Math.floor(total)
      )
    : 0;
  // What the customer must still cover after points are applied.
  const owed = Math.max(total - redeemApplied, 0);

  const paidNum = onCredit ? 0 : Number.parseFloat(tendered || "0");
  const change = paidNum > owed ? paidNum - owed : 0;
  const shortfall = paidNum < owed ? owed - paidNum : 0;
  const needsCustomer = (onCredit || shortfall > 0) && owed > 0;
  const earnPreview = member ? Math.floor(owed / 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* ---- Products ---- */}
      <div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addProduct(p)}
              className="rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
            >
              <p className="text-sm font-medium text-ink">{p.name}</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {formatRupees(p.salePrice)}
                {p.packSize === null ? "/kg" : ` · ${packLabel(p)}`}
              </p>
              <p
                className={`mt-1 text-xs ${p.onHand <= 0 ? "text-red-600" : "text-ink-soft"}`}
              >
                {p.onHand} on hand
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Ticket ---- */}
      <aside className="h-fit space-y-3 rounded-2xl border border-line bg-surface p-4 lg:sticky lg:top-20">
        <h2 className="text-sm font-medium text-ink">This sale</h2>

        {done ? (
          <div className="rounded-xl bg-brand-50 p-4 text-center">
            <p className="text-sm text-brand-800">Sale recorded</p>
            <p className="mt-1 text-2xl font-semibold text-brand-900">
              {formatRupees(done.total)}
            </p>
            {done.change > 0 ? (
              <p className="mt-1 text-sm text-brand-800">
                Change: {formatRupees(done.change)}
              </p>
            ) : null}
            {done.redeemed > 0 ? (
              <p className="mt-1 text-sm text-brand-800">
                {done.redeemed} pts redeemed (−{formatRupees(done.redeemed)})
              </p>
            ) : null}
            {done.earned > 0 ? (
              <p className="mt-1 text-sm font-medium text-brand-700">
                +{done.earned} points added to their card
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setDone(null)}
              className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              New sale
            </button>
          </div>
        ) : cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-soft">
            Tap a product to add it.
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {cart.map((l) => (
                <li key={l.productId} className="rounded-lg bg-canvas p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{l.name}</span>
                    <button
                      type="button"
                      onClick={() => removeLine(l.productId)}
                      className="text-xs text-ink-soft hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-sm">
                    <input
                      type="number"
                      min="0"
                      step={l.loose ? "0.1" : "1"}
                      inputMode="decimal"
                      value={l.quantity}
                      onChange={(e) =>
                        setLine(l.productId, {
                          quantity: Math.max(0, Number.parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-16 rounded border border-line bg-surface px-2 py-1 tabular-nums"
                      aria-label={`Quantity of ${l.name}`}
                    />
                    <span className="text-ink-soft">{l.loose ? "kg" : "×"}</span>
                    <span className="text-ink-soft">@</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="decimal"
                      value={l.unitPrice}
                      onChange={(e) =>
                        setLine(l.productId, {
                          unitPrice: Math.max(0, Number.parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-20 rounded border border-line bg-surface px-2 py-1 tabular-nums"
                      aria-label={`Price of ${l.name}`}
                    />
                    <span className="ml-auto font-medium text-ink tabular-nums">
                      {formatRupees(l.quantity * l.unitPrice)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <span className="font-medium text-ink">Total</span>
              <span className="text-xl font-semibold text-ink tabular-nums">
                {formatRupees(total)}
              </span>
            </div>

            {/* Loyalty card — scan the customer's QR (or key the code) to earn
                and spend points on this sale. */}
            <div className="rounded-lg bg-canvas p-2.5">
              {member ? (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {member.name}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {Math.floor(member.points)} points available
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMember(null);
                        setRedeem("");
                        setLoyaltyCode("");
                      }}
                      className="text-xs text-ink-soft hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                  {member.points >= 1 && total > 0 ? (
                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-xs text-ink-soft">Redeem</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={redeem}
                        onChange={(e) => setRedeem(e.target.value)}
                        placeholder="0"
                        className="w-20 rounded border border-line bg-surface px-2 py-1 text-sm tabular-nums"
                        aria-label="Points to redeem"
                      />
                      <span className="text-xs text-ink-soft">pts</span>
                      <button
                        type="button"
                        onClick={() =>
                          setRedeem(
                            String(Math.min(Math.floor(member.points), Math.floor(total)))
                          )
                        }
                        className="ml-auto text-xs font-medium text-brand-700 hover:underline"
                      >
                        Use max
                      </button>
                    </div>
                  ) : null}
                  {redeemApplied > 0 ? (
                    <p className="mt-1 text-xs text-brand-700">
                      −{formatRupees(redeemApplied)} from {redeemApplied} points
                    </p>
                  ) : null}
                  {earnPreview > 0 ? (
                    <p className="mt-0.5 text-xs text-ink-soft">
                      Earns +{earnPreview} points on this sale
                    </p>
                  ) : null}
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      value={loyaltyCode}
                      onChange={(e) => setLoyaltyCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          findMember();
                        }
                      }}
                      placeholder="Scan / enter loyalty code"
                      className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm uppercase outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={findMember}
                      disabled={lookingUp || !loyaltyCode.trim()}
                      className="shrink-0 rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                    >
                      {lookingUp ? "…" : "Find"}
                    </button>
                  </div>
                  {loyaltyMsg ? (
                    <p className="mt-1 text-xs text-red-600">{loyaltyMsg}</p>
                  ) : null}
                </div>
              )}
            </div>

            {/* Payment */}
            <div className="space-y-2">
              <div className="flex gap-1.5">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    disabled={onCredit}
                    onClick={() => setMethod(m.value)}
                    className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                      method === m.value && !onCredit
                        ? "bg-brand-600 text-white"
                        : "bg-canvas text-ink-soft hover:bg-brand-50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={onCredit}
                  onChange={(e) => setOnCredit(e.target.checked)}
                  className="size-4 accent-brand-600"
                />
                Full credit (unpaid)
              </label>

              {!onCredit ? (
                <div>
                  <label className="text-xs text-ink-soft">Amount received</label>
                  <input
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder={owed.toFixed(0)}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums outline-none focus:border-brand-500"
                  />
                  {change > 0 ? (
                    <p className="mt-1 text-sm text-brand-700">
                      Change: {formatRupees(change)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {needsCustomer ? (
                <div className="rounded-lg bg-amber-50 p-2.5">
                  <p className="text-xs font-medium text-amber-900">
                    {onCredit ? "Credit sale" : `${formatRupees(shortfall)} on credit`} —
                    who owes it?
                  </p>
                  <input
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="Customer name"
                    className="mt-1.5 w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
                  />
                  <input
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    inputMode="numeric"
                    placeholder="Mobile number"
                    className="mt-1.5 w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
                  />
                </div>
              ) : null}
            </div>

            {error ? (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={pending || total <= 0}
              onClick={completeSale}
              className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending
                ? "Recording…"
                : onCredit
                  ? `Record ${formatRupees(total)} credit sale`
                  : owed <= 0
                    ? "Complete sale (paid with points)"
                    : `Take ${formatRupees(owed)}`}
            </button>

            <button
              type="button"
              onClick={reset}
              className="w-full text-center text-sm text-ink-soft hover:text-ink"
            >
              Clear sale
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
