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

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const raw = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
  if (!raw) return NextResponse.json({ error: "No image." }, { status: 400 });

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
