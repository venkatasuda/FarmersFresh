"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Address = {
  id: string;
  label: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  address_line: string;
  city: string | null;
  pincode: string | null;
  landmark: string | null;
  is_default: boolean;
};

/**
 * The customer's saved addresses. All CRUD goes straight to the table — RLS
 * ties every row to the logged-in user, so there's no server action to wrap;
 * the browser client is safe here.
 */
export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    label: "",
    contact_name: "",
    contact_phone: "",
    address_line: "",
    city: "",
    pincode: "",
    landmark: "",
    lat: null as number | null,
    lng: null as number | null,
  });

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("customer_addresses")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setAddresses((data ?? []) as Address[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!form.address_line.trim()) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("customer_addresses").insert({
        user_id: user.id,
        label: form.label.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.replace(/\D/g, "").slice(-10) || null,
        address_line: form.address_line.trim(),
        city: form.city.trim() || null,
        pincode: form.pincode.replace(/\D/g, "").slice(0, 6) || null,
        landmark: form.landmark.trim() || null,
        lat: form.lat,
        lng: form.lng,
        is_default: addresses.length === 0,
      });
      setForm({
        label: "",
        contact_name: "",
        contact_phone: "",
        address_line: "",
        city: "",
        pincode: "",
        landmark: "",
        lat: null,
        lng: null,
      });
      setAdding(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const supabase = createClient();
    await supabase.from("customer_addresses").delete().eq("id", id);
    await load();
  }

  async function makeDefault(id: string) {
    const supabase = createClient();
    await supabase
      .from("customer_addresses")
      .update({ is_default: true })
      .eq("id", id);
    await load();
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
          <span className="h-5 w-1 rounded-full bg-brand-500" />
          Saved addresses
        </h2>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            + Add address
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="mb-4 space-y-3 rounded-2xl border border-line bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label (Home, Office)" className={inp} />
            <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Name" className={inp} />
          </div>
          <textarea value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} placeholder="Address" rows={2} className={inp} />
          <div className="grid gap-3 sm:grid-cols-3">
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className={inp} />
            <input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="PIN" inputMode="numeric" className={inp} />
            <input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} placeholder="Landmark" className={inp} />
          </div>
          <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="Phone" inputMode="numeric" className={inp} />
          <button
            type="button"
            onClick={useMyLocation}
            className="rounded-lg border border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            {form.lat != null ? "✓ Location pinned" : "📍 Use my current location"}
          </button>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !form.address_line} onClick={save} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Saving…" : "Save address"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-line px-4 py-2 text-sm text-ink-soft">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {addresses.length === 0 && !adding ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-5 py-6 text-center text-sm text-ink-soft">
          No saved addresses yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {a.label ?? "Address"}
                    {a.is_default ? (
                      <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-800">
                        Default
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {a.address_line}
                    {a.city ? `, ${a.city}` : ""}
                    {a.pincode ? ` — ${a.pincode}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  {!a.is_default ? (
                    <button type="button" onClick={() => makeDefault(a.id)} className="text-brand-700 hover:underline">
                      Set default
                    </button>
                  ) : null}
                  <button type="button" onClick={() => remove(a.id)} className="text-ink-soft hover:text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const inp =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500";
