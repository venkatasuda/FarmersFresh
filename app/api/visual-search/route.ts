import { NextResponse, type NextRequest } from "next/server";

/**
 * Visual product search: a photo in, a searchable product word out.
 *
 * The recogniser is PLUGGABLE so you can swap in your own model later with no
 * app changes — set VISION_PROVIDER:
 *
 *   VISION_PROVIDER=google   → Google Cloud Vision (needs GOOGLE_VISION_API_KEY)
 *   VISION_PROVIDER=custom   → your own model endpoint (needs VISION_ENDPOINT_URL,
 *                              optional VISION_ENDPOINT_TOKEN for auth)
 *
 * Your custom endpoint's contract (see docs/VISUAL_SEARCH.md):
 *   Request  (POST JSON): { "image": "<base64, no data-url prefix>" }
 *   Response (JSON):      { "term": "coriander" }   // preferred, or
 *                         { "labels": ["coriander","herb",...] } // most→least specific
 *
 * Either way this route filters out generic words and returns one term the app
 * searches the catalogue with. No-ops (503) until a provider is configured.
 */

const GENERIC = new Set(
  [
    "food", "produce", "vegetable", "vegetables", "fruit", "fruits", "ingredient",
    "plant", "leaf vegetable", "natural foods", "whole food", "local food",
    "superfood", "vegan nutrition", "still life photography", "herb", "spice",
    "root vegetable", "staple food", "dish", "cuisine", "recipe",
  ].map((s) => s.toLowerCase())
);

const PROVIDER =
  process.env.VISION_PROVIDER ??
  (process.env.GOOGLE_VISION_API_KEY ? "google" : process.env.VISION_ENDPOINT_URL ? "custom" : "");

// --- Abuse limits -------------------------------------------------------
// Each call hits a paid vision API, so bound the per-request cost (size/type)
// and the per-caller rate before we forward anything upstream.
const MAX_B64_CHARS = 7_000_000;              // ~5 MB decoded image
const ALLOWED_TYPES = /^data:image\/(jpe?g|png|webp);base64,/i;
const B64_ONLY = /^[A-Za-z0-9+/=\s]+$/;       // reject non-base64 junk
const RATE_MAX = 10;                          // requests…
const RATE_WINDOW_MS = 60_000;                // …per IP per minute

// ponytail: per-instance in-memory window — good enough for a single warm
// serverless instance; move to Upstash/Redis or a DB counter if a distributed
// limit is needed. Bounded map so it can't grow without limit.
const hits = new Map<string, { n: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { n: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  h.n += 1;
  return h.n > RATE_MAX;
}

async function recogniseGoogle(raw: string): Promise<string[]> {
  const key = process.env.GOOGLE_VISION_API_KEY!;
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: raw },
          features: [
            { type: "OBJECT_LOCALIZATION", maxResults: 5 },
            { type: "LABEL_DETECTION", maxResults: 10 },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error("google vision failed");
  const data = (await res.json()) as {
    responses?: {
      localizedObjectAnnotations?: { name?: string }[];
      labelAnnotations?: { description?: string }[];
    }[];
  };
  const r = data.responses?.[0] ?? {};
  return [
    ...(r.localizedObjectAnnotations ?? []).map((o) => o.name ?? ""),
    ...(r.labelAnnotations ?? []).map((l) => l.description ?? ""),
  ];
}

async function recogniseCustom(raw: string): Promise<string[]> {
  const url = process.env.VISION_ENDPOINT_URL!;
  const token = process.env.VISION_ENDPOINT_TOKEN;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ image: raw }),
  });
  if (!res.ok) throw new Error("custom model failed");
  const data = (await res.json()) as { term?: string; labels?: string[] };
  if (Array.isArray(data.labels)) return data.labels;
  if (data.term) return [data.term];
  return [];
}

export async function POST(request: NextRequest) {
  if (!PROVIDER || (PROVIDER === "google" && !process.env.GOOGLE_VISION_API_KEY)
      || (PROVIDER === "custom" && !process.env.VISION_ENDPOINT_URL)) {
    return NextResponse.json({ error: "Visual search isn't set up yet." }, { status: 503 });
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many searches. Please wait a minute." }, { status: 429 });
  }

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const input = body.image ?? "";
  if (input.length > MAX_B64_CHARS) {
    return NextResponse.json({ error: "That image is too large (max ~5 MB)." }, { status: 413 });
  }
  // If a data-url prefix is present it must be an allowed image type; a bare
  // base64 string (the documented custom-model contract) is accepted too.
  const hasPrefix = input.startsWith("data:");
  if (hasPrefix && !ALLOWED_TYPES.test(input)) {
    return NextResponse.json({ error: "Only JPEG, PNG or WebP images are supported." }, { status: 415 });
  }

  const raw = input.replace(/^data:image\/\w+;base64,/, "");
  if (!raw) return NextResponse.json({ error: "No image." }, { status: 400 });
  if (!B64_ONLY.test(raw)) {
    return NextResponse.json({ error: "That doesn't look like an image." }, { status: 400 });
  }

  let candidates: string[];
  try {
    candidates = PROVIDER === "custom" ? await recogniseCustom(raw) : await recogniseGoogle(raw);
  } catch {
    return NextResponse.json({ error: "Couldn't read the photo." }, { status: 502 });
  }

  const cleaned = candidates
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 1 && !GENERIC.has(s.toLowerCase()));

  return NextResponse.json({ term: cleaned[0] ?? null, candidates: cleaned.slice(0, 6) });
}
