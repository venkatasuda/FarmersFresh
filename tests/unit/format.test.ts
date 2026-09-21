import { describe, it, expect } from "vitest";
import { num, formatRupees, formatQty, formatLineQty } from "@/lib/format";

describe("num", () => {
  it("parses numeric strings (Postgres numeric arrives as a string)", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num("1000")).toBe(1000);
  });
  it("returns the fallback for null/undefined/garbage", () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num("abc", 7)).toBe(7);
    expect(num("", 3)).toBe(3);
  });
  it("passes real numbers through", () => {
    expect(num(42)).toBe(42);
    expect(num(0)).toBe(0);
  });
});

describe("formatRupees", () => {
  it("groups in the Indian style with no paise", () => {
    const out = formatRupees(1234);
    expect(out).toContain("1,234");
    expect(out).toMatch(/₹/);
  });
  it("groups lakhs", () => {
    expect(formatRupees(100000)).toContain("1,00,000");
  });
});

describe("formatQty", () => {
  it("shows grams below a kilo", () => {
    expect(formatQty(0.5, "kg")).toBe("500 g");
  });
  it("shows kilos at or above one", () => {
    expect(formatQty(1.5, "kg")).toBe("1.5 kg");
  });
  it("counts pieces", () => {
    expect(formatQty(2, "piece")).toBe("2 pc");
  });
});

describe("formatLineQty", () => {
  it("uses the pack label for a single pack", () => {
    expect(formatLineQty(1, "kg", "5 kg")).toBe("5 kg");
  });
  it("multiplies the pack label for several packs", () => {
    expect(formatLineQty(2, "kg", "500 g")).toBe("2 × 500 g");
  });
  it("falls back to a weight for loose goods", () => {
    expect(formatLineQty(1.5, "kg", null)).toBe("1.5 kg");
  });
});
