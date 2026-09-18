import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { toAmount, toQuantity, sanitizeError } from "../../lib/guard";
import { num, formatQty, formatLineQty, formatRupees } from "../../lib/format";
describe("money and quantity validation", () => {
  it.each([null, undefined, "", NaN, Infinity, -Infinity, -1, 0, "12junk", "0x10", true, [], {}])("rejects malformed values: %s", value => {
    expect(toAmount(value)).toBeNull(); expect(toQuantity(value)).toBeNull();
  });
  it("enforces limits and rounding", () => {
    expect(toAmount("123.456")).toBe(123.46);
    expect(toQuantity("1.23456")).toBe(1.235);
    expect(toAmount(101, 100)).toBeNull(); expect(toQuantity(51, 50)).toBeNull();
    expect(toAmount(0.001)).toBeNull(); expect(toQuantity(0.00001)).toBeNull();
    expect(toAmount(100, 100)).toBe(100); expect(toQuantity(50, 50)).toBe(50);
  });
  it("never emits zero, negative, infinite or above-limit accepted values", () => {
    fc.assert(fc.property(fc.double({ noNaN: false }), value => {
      for (const parsed of [toAmount(value, 50), toQuantity(value, 50)]) {
        if (parsed !== null) { expect(Number.isFinite(parsed)).toBe(true); expect(parsed).toBeGreaterThan(0); expect(parsed).toBeLessThanOrEqual(50); }
      }
    }), { numRuns: 2000, seed: 20260918 });
  });
});
describe("customer-safe errors and formatting", () => {
  it.each(["violates constraint orders_total_check", "permission denied for relation profiles", "duplicate key", "syntax error", "invalid input", "function does not exist"])("hides DB errors: %s", message => expect(sanitizeError(message)).toBe("Something went wrong. Please try again."));
  it("keeps deliberate business errors and hides missing/long errors", () => {
    expect(sanitizeError("Only 2 kg left.")).toBe("Only 2 kg left.");
    expect(sanitizeError(undefined, "Retry")).toBe("Retry"); expect(sanitizeError("x".repeat(201), "Retry")).toBe("Retry");
  });
  it("handles numeric DB fields and formats loose/packed goods", () => {
    expect(num("12.50")).toBe(12.5); expect(num(null, 9)).toBe(9); expect(num(undefined, 9)).toBe(9);
    expect(num(Infinity, 9)).toBe(9); expect(num("bad", 9)).toBe(9); expect(num(4)).toBe(4);
    expect(formatQty(0.5, "kg")).toBe("500 g"); expect(formatQty(2, "kg")).toBe("2 kg");
    expect(formatQty(2, "piece")).toBe("2 pc"); expect(formatLineQty(2, "kg", "500 g")).toBe("2 × 500 g");
    expect(formatLineQty(1, "kg", "500 g")).toBe("500 g"); expect(formatLineQty(1, "kg", null)).toBe("1 kg");
    expect(formatRupees(1500)).toContain("1,500");
  });
});
