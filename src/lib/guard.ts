/**
 * Small input guards shared by Server Actions.
 *
 * The database is the real gatekeeper — every function validates its own
 * inputs and RLS restricts every row. These helpers are defence in depth: they
 * turn junk into a clean rejection with a friendly message BEFORE a round trip,
 * and they stop a raw database error from ever being shown to a customer.
 */

// Accept a whole decimal value, including scientific notation, without
// coercing booleans/arrays/objects or accepting text such as "12junk".
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function positiveRounded(value: unknown, max: number, scale: number): number | null {
  if (!Number.isFinite(max) || max <= 0) return null;

  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    const text = value.trim();
    if (!DECIMAL.test(text)) return null;
    n = Number(text);
  } else {
    return null;
  }

  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  const rounded = Math.round(n * scale) / scale;
  // Rounding can turn a positive value into zero or push it above the limit.
  if (!Number.isFinite(rounded) || rounded <= 0 || rounded > max) return null;
  return rounded;
}

/** A finite, positive amount, rounded to paise, or null. */
export function toAmount(value: unknown, max = 10_000_000): number | null {
  return positiveRounded(value, max, 100);
}

/** A finite quantity in (0, max], rounded to three decimal places, or null. */
export function toQuantity(value: unknown, max = 1000): number | null {
  return positiveRounded(value, max, 1000);
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
 * Only explicitly approved business messages pass through. Unknown errors use
 * the caller's safe fallback; a blacklist alone cannot identify every leak.
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
  const safe = new Set([
    "Not signed in.", "Please sign in.", "Order not found.", "Product not found.",
    "Insufficient permission.", "You do not have access to that location.",
    "Quantity must be greater than zero.", "A delivered order cannot be cancelled.",
    "Add at least one item.", "Name is required.",
    "Stock changed. Refresh and count again.", "Enter a valid stock quantity.",
    "Give a count reason within 500 characters.", "Keep the note within 500 characters.",
    "Choose another store in your organization.", "Not enough unexpired batch stock to transfer.",
    "Enter a whole number of pieces.", "This request was already used for a different change.",
    "Use the stock count or transfer workflow.", "Insufficient stock.",
    "Access denied.", "This delivery is assigned to another rider.",
    "Only confirmed or packed deliveries can be claimed or released.",
    "A delivery staff membership is required to go on shift.", "Choose a shift status.",
    "Invalid location or ETA.", "This delivery is not currently on the way.",
    "Give a delivery failure reason within 500 characters.", "Report the failed delivery first.",
    "Return the failed delivery to the store before retrying.",
    "Collect the exact order total.", "Only unpaid delivered COD orders can be collected.",
    "Choose today or a past business date.", "Close a completed business day.",
    "Enter a valid cash amount.", "This cash day is already closed.",
    "Cash totals changed. Refresh before closing.", "Explain the cash shortage or surplus.",
    "Give a refund reason within 500 characters.", "This order already has a cash refund.",
    "This order already has a wallet refund.", "This return already has a cash refund.",
    "Only collected COD returns can be refunded in cash.", "Refund exceeds collected cash.",
    "Close the active till shift first.", "This till shift is already closed.",
  ]);
  return safe.has(message) || /^Only \d+(?:\.\d+)? (?:kg|g|items?|pieces?) left\.$/.test(message) ? message : fallback;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

export function safeNext(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return fallback;
  return value;
}
