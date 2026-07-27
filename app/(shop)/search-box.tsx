"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { suggestProducts, type Suggestion } from "./search-actions";
import { toSearchTerm, VOICE_LANGS } from "@/lib/grocery-terms";
import { formatRupees } from "@/lib/format";

// Minimal shapes for the browser SpeechRecognition API (no lib types shipped).
type SpeechResultLike = {
  results?: { [i: number]: { [j: number]: { transcript?: string } } };
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  onresult: (e: SpeechResultLike) => void;
  onend: () => void;
  onerror: () => void;
};

/**
 * Search with live autocomplete, like BigBasket/Amazon: as you type, matching
 * products drop down with image + price. Debounced so it doesn't hit the server
 * on every keystroke. Enter (or "see all") goes to the full results page.
 */
export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [scanning, setScanning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const visualOn = Boolean(process.env.NEXT_PUBLIC_VISUAL_SEARCH);

  async function handlePhoto(file: File) {
    setScanning(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error("read failed"));
        fr.readAsDataURL(file);
      });
      const resp = await fetch("/api/visual-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const j = (await resp.json().catch(() => ({}))) as { term?: string };
      if (j.term) {
        setQ(j.term);
        go(j.term);
      } else {
        setQ("");
        setItems([]);
        alert("We couldn't recognise that. Try typing the name.");
      }
    } catch {
      alert("Couldn't scan that photo. Try again.");
    } finally {
      setScanning(false);
    }
  }

  // Voice search uses the browser's built-in speech recognition (no server, no
  // keys). Only shown where supported. Great for customers who'd rather speak.
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setVoiceOn(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function startVoice() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = voiceLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e: SpeechResultLike) => {
      const said = e.results?.[0]?.[0]?.transcript ?? "";
      if (said) {
        // Map a regional word (e.g. "dhaniya") to the English product term.
        const term = toSearchTerm(said);
        setQ(term);
        go(term);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  // Debounced suggestions.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const t = window.setTimeout(async () => {
      const r = await suggestProducts(term);
      setItems(r);
      setOpen(true);
    }, 180);
    return () => window.clearTimeout(t);
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(term: string) {
    setOpen(false);
    router.push(term.trim() ? `/search?q=${encodeURIComponent(term.trim())}` : "/");
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="relative"
      >
        <label htmlFor="shop-search" className="sr-only">
          Search products
        </label>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="shop-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          placeholder="Search mutton, rice, masala…"
          className={`w-full rounded-full border border-line bg-canvas py-2.5 pl-9 text-sm text-ink outline-none transition-colors focus:border-brand-500 focus:bg-surface ${
            voiceOn && visualOn ? "pr-28" : voiceOn ? "pr-24" : visualOn ? "pr-11" : "pr-4"
          }`}
          autoComplete="off"
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          {voiceOn ? (
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              aria-label="Voice language"
              className="max-w-[4.5rem] rounded-md border border-line bg-surface py-1 pl-1 pr-0.5 text-xs text-ink-soft outline-none"
              title="Voice search language"
            >
              {VOICE_LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          ) : null}
          {visualOn ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhoto(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Search by photo"
                className={`flex size-7 items-center justify-center rounded-full ${
                  scanning ? "animate-pulse bg-brand-600 text-white" : "text-ink-soft hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
                  <path d="M4 8a2 2 0 0 1 2-2h1l1-1.5h6L17 6h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              </button>
            </>
          ) : null}
          {voiceOn ? (
            <button
              type="button"
              onClick={startVoice}
              aria-label="Search by voice"
              className={`flex size-7 items-center justify-center rounded-full ${
                listening ? "animate-pulse bg-brand-600 text-white" : "text-ink-soft hover:bg-brand-50 hover:text-brand-700"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </form>

      {open && items.length > 0 ? (
        <div className="absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          <ul>
            {items.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/shop/${s.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-brand-50"
                >
                  <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-brand-50">
                    {s.imagePath ? (
                      <Image src={s.imagePath} alt="" fill sizes="36px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{s.name}</span>
                    {s.category ? (
                      <span className="block text-xs text-ink-soft">{s.category}</span>
                    ) : null}
                  </span>
                  <span className="text-sm font-medium text-ink tabular-nums">
                    {formatRupees(s.price)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => go(q)}
            className="w-full border-t border-line px-3 py-2.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            See all results for &ldquo;{q.trim()}&rdquo;
          </button>
        </div>
      ) : null}
    </div>
  );
}
