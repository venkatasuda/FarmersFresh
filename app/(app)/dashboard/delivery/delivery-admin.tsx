"use client";

import { useState, useTransition } from "react";
import {
  addZone,
  removeZone,
  saveNotificationTargets,
} from "./actions";

type Zone = { id: string; pincode: string; areaName: string | null };

export function DeliveryAdmin({
  zones,
  notifyEmail,
  notifyPhone,
}: {
  zones: Zone[];
  notifyEmail: string;
  notifyPhone: string;
}) {
  const [pending, startTransition] = useTransition();
  const [pincode, setPincode] = useState("");
  const [area, setArea] = useState("");
  const [zoneError, setZoneError] = useState<string | null>(null);

  const [email, setEmail] = useState(notifyEmail);
  const [phone, setPhone] = useState(notifyPhone);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  function submitZone() {
    setZoneError(null);
    startTransition(async () => {
      const r = await addZone(pincode, area);
      if (!r.ok) {
        setZoneError(r.message);
        return;
      }
      setPincode("");
      setArea("");
    });
  }

  function saveTargets() {
    setNotifyError(null);
    setSavedMsg(null);
    startTransition(async () => {
      const r = await saveNotificationTargets(email, phone);
      if (!r.ok) {
        setNotifyError(r.message);
        return;
      }
      setSavedMsg("Saved.");
    });
  }

  return (
    <div className="space-y-8">
      {/* ---- Where alerts go ---- */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">Where new orders alert you</h2>
        <p className="mt-1 text-sm text-ink-soft">
          You get an email and a message the moment an order is placed. Leave a
          field blank to turn that channel off.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink">Alert email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">
              Alert mobile (SMS & WhatsApp)
            </span>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit number"
              className={inputClass}
            />
          </label>
        </div>

        {notifyError ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {notifyError}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={saveTargets}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Save
          </button>
          {savedMsg ? (
            <span className="text-sm text-brand-700">{savedMsg}</span>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-ink-soft">
          Email works as soon as your provider key is set. SMS and WhatsApp
          switch on once their provider is connected — until then those alerts
          are queued and marked &ldquo;skipped&rdquo;, never lost.
        </p>
      </section>

      {/* ---- Delivery PIN codes ---- */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-medium text-ink">Delivery areas</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Checkout only accepts orders to these PIN codes. Add every area you
          can reach.{" "}
          {zones.length === 0 ? (
            <span className="text-amber-700">
              With none listed, the shop accepts every address — add yours
              before launch.
            </span>
          ) : null}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-sm font-medium text-ink">PIN code</span>
            <input
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="500034"
              className={`${inputClass} w-32`}
            />
          </label>
          <label className="block flex-1">
            <span className="text-sm font-medium text-ink">Area name</span>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Banjara Hills"
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={submitZone}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Add
          </button>
        </div>

        {zoneError ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {zoneError}
          </p>
        ) : null}

        {zones.length > 0 ? (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {zones.map((z) => (
              <li
                key={z.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="text-sm text-ink">
                  <span className="font-medium tabular-nums">{z.pincode}</span>
                  {z.areaName ? (
                    <span className="ml-2 text-ink-soft">{z.areaName}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await removeZone(z.id);
                    })
                  }
                  className="text-sm text-ink-soft hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500";
