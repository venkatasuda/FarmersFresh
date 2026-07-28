"use client";

import { useState, useTransition } from "react";
import { getColdChain, logTemperature, type ColdChain } from "./actions";

// Sensible default ranges (°C) per storage area; editable before logging.
const AREAS = [
  { name: "Freezer", min: -25, max: -15 },
  { name: "Chiller", min: 0, max: 5 },
  { name: "Meat display", min: 0, max: 4 },
  { name: "Dry store", min: 10, max: 25 },
] as const;

export function ColdChainClient({
  initial,
  locationId,
}: {
  initial: ColdChain;
  locationId: string | null;
}) {
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => setData(await getColdChain(7)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Cold chain</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Record storage temperatures. Anything outside the target range is flagged
          as a breach — your food-safety audit trail.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs text-ink-soft">Breaches (last 7 days)</p>
        <p
          className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${
            data.breaches > 0 ? "text-red-600" : "text-brand-700"
          }`}
        >
          {data.breaches}
        </p>
      </div>

      {!locationId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No dispatch store is set, so readings can&apos;t be recorded.
        </div>
      ) : (
        <LogForm locationId={locationId} onSaved={refresh} />
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
          Recent readings
        </h2>
        {data.readings.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.readings.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-ink">{r.area}</span>
                  {r.targetMin !== null || r.targetMax !== null ? (
                    <span className="ml-2 text-xs text-ink-soft">
                      target {r.targetMin ?? "—"}…{r.targetMax ?? "—"}°C
                    </span>
                  ) : null}
                  {r.note ? <span className="ml-2 text-xs text-ink-soft">· {r.note}</span> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-medium tabular-nums ${
                      r.breach ? "text-red-600" : "text-ink"
                    }`}
                  >
                    {r.tempC}°C
                  </span>
                  {r.breach ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      breach
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
                      ok
                    </span>
                  )}
                  <span className="w-24 shrink-0 text-right text-xs text-ink-soft">
                    {new Date(r.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LogForm({ locationId, onSaved }: { locationId: string; onSaved: () => void }) {
  const [areaIdx, setAreaIdx] = useState(0);
  const [min, setMin] = useState(String(AREAS[0].min));
  const [max, setMax] = useState(String(AREAS[0].max));
  const [temp, setTemp] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function pickArea(i: number) {
    setAreaIdx(i);
    setMin(String(AREAS[i].min));
    setMax(String(AREAS[i].max));
  }

  function submit() {
    setError(null);
    setFlash(null);
    const t = Number.parseFloat(temp);
    if (!Number.isFinite(t)) {
      setError("Enter a temperature.");
      return;
    }
    startTransition(async () => {
      const r = await logTemperature({
        locationId,
        area: AREAS[areaIdx].name,
        tempC: t,
        min: min === "" ? null : Number.parseFloat(min),
        max: max === "" ? null : Number.parseFloat(max),
        note,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setTemp("");
      setNote("");
      setFlash(r.breach ? "⚠ Logged — out of range (breach)" : "✓ Logged — within range");
      onSaved();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Log a reading</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-xs text-ink-soft">Area</span>
          <select
            value={areaIdx}
            onChange={(e) => pickArea(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            {AREAS.map((a, i) => (
              <option key={a.name} value={i}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-ink-soft">Temp (°C)</span>
          <input
            type="number"
            step="0.1"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-soft">Target min</span>
          <input
            type="number"
            step="0.1"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-soft">Target max</span>
          <input
            type="number"
            step="0.1"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs text-ink-soft">Note (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </label>

      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Logging…" : "Log reading"}
        </button>
        {flash ? (
          <span className={flash.startsWith("⚠") ? "text-sm text-red-600" : "text-sm text-brand-700"}>
            {flash}
          </span>
        ) : null}
      </div>
    </div>
  );
}
