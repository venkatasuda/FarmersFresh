/**
 * Typo- and language-tolerant product search. CLIENT-SAFE (pure, no server
 * imports) so both the results page and the autocomplete action share it.
 *
 * Matches on tokens with: substring, then bounded edit-distance (so "chiken"
 * finds "chicken", "corriander" finds "coriander"), and folds each query word
 * through the regional term-map ("dhaniya" -> "coriander"). Every query word
 * must land, so results stay relevant.
 *
 * ponytail: in-memory scan over the catalogue — right for tens–hundreds of
 * products. Past ~1k, move to a pg_trgm RPC with a GIN index.
 */
import { toSearchTerm } from "./grocery-terms";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Classic bounded Levenshtein (two-row).
function lev(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Allowed typos scale with word length; short words must be exact.
function tolerance(len: number): number {
  return len >= 7 ? 2 : len >= 4 ? 1 : 0;
}

// 2 = substring hit, 1 = fuzzy hit, 0 = miss.
function tokenScore(qt: string, tokens: string[]): number {
  let best = 0;
  const tol = tolerance(qt.length);
  for (const t of tokens) {
    if (t.includes(qt) || qt.includes(t)) return 2;
    if (tol > 0 && lev(qt, t) <= tol) best = 1;
  }
  return best;
}

/** Relevance score of a query against a text blob. 0 = no match. */
export function matchScore(query: string, haystack: string): number {
  const tokens = norm(haystack).split(" ").filter(Boolean);
  const qtokens = norm(query).split(" ").filter(Boolean);
  if (!tokens.length || !qtokens.length) return 0;

  let total = 0;
  for (const raw of qtokens) {
    const mapped = norm(toSearchTerm(raw));
    const s = Math.max(
      tokenScore(raw, tokens),
      mapped && mapped !== raw ? tokenScore(mapped, tokens) : 0
    );
    if (s === 0) return 0; // every query word must land
    total += s;
  }
  return total;
}

/** Filter + rank items by a query. Best matches (and shorter names) first. */
export function searchItems<
  T extends {
    name: string;
    description?: string | null;
    category?: string | null;
    brand?: string | null;
  },
>(items: T[], query: string): T[] {
  if (!query.trim()) return [];
  return items
    .map((p) => ({
      p,
      s: matchScore(query, [p.name, p.description, p.category, p.brand].filter(Boolean).join(" ")),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.length - b.p.name.length)
    .map((x) => x.p);
}
