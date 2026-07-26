/**
 * Small input guards shared by Server Actions.
 *
 * The database is the real gatekeeper — every function validates its own
 * inputs and RLS restricts every row. These helpers are defence in depth: they
 * turn junk into a clean rejection with a friendly message BEFORE a round trip,
 * and they stop a raw database error from ever being shown to a customer.
 */

/**
 * A finite, positive amount, or null. Rejects NaN, Infinity, negatives and
 * absurd values — the things a tampered client or a fat-fingered field produce.
 */
export function toAmount(value: unknown, max = 10_000_000): number | null {
  const n =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return Math.round(n * 100) / 100;
}

/** A finite quantity in (0, max]. Used for weights and pack counts. */
export function toQuantity(value: unknown, max = 1000): number | null {
  const n =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return Math.round(n * 1000) / 1000;
}

// Technical tokens that mean a database/internal error surfaced, rather than
// one of our own deliberate, friendly RAISE messages.
const LEAKY = [
  "violates",
  "constraint",
  "syntax",
  "null value",
  "relation",
  "column",
  "permission denied",
  "duplicate key",
  "invalid input",
  "out of range",
  "function",
  "operator",
];

/**
 * Returns a message safe to show a user. Our database functions raise plain,
 * friendly sentences ("Only 2 kg of Leg left.") — those pass through. Anything
 * that smells like a raw Postgres error is replaced with a generic line, so
 * internals never leak to a customer.
 */
export function sanitizeError(
  message: string | undefined,
  fallback = "Something went wrong. Please try again."
): string {
  if (!message) return fallback;
  const lower = message.toLowerCase();
  if (LEAKY.some((t) => lower.includes(t))) return fallback;
  // Guard against a wall of text — a friendly message is short.
  if (message.length > 200) return fallback;
  return message;
}
