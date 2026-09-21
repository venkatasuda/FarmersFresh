import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isLoose,
  packLabel,
  unitPrice,
  discountPercent,
  nextStatus,
  buildCategoryTree,
  deliveryFeeFor,
  FREE_DELIVERY_OVER,
  type Category,
  type OrderStatus,
} from "@/lib/types";

describe("isLoose", () => {
  it("is true only when there is no pack size", () => {
    expect(isLoose({ packSize: null })).toBe(true);
    expect(isLoose({ packSize: 5 })).toBe(false);
  });
});

describe("packLabel", () => {
  it("labels packs by unit", () => {
    expect(packLabel({ packSize: 5, packUnit: "kg" })).toBe("5 kg");
    expect(packLabel({ packSize: 1, packUnit: "l" })).toBe("1 L");
    expect(packLabel({ packSize: 6, packUnit: "piece" })).toBe("6 pc");
    expect(packLabel({ packSize: 1, packUnit: "dozen" })).toBe("1 dozen");
  });
  it("is null for loose goods", () => {
    expect(packLabel({ packSize: null, packUnit: null })).toBeNull();
  });
});

describe("unitPrice", () => {
  it("normalises grams and millilitres to kg / L", () => {
    expect(unitPrice({ salePrice: 100, packSize: 500, packUnit: "g" })).toEqual({
      value: 200,
      per: "kg",
    });
    expect(unitPrice({ salePrice: 60, packSize: 500, packUnit: "ml" })).toEqual({
      value: 120,
      per: "L",
    });
  });
  it("prices per piece for a dozen", () => {
    expect(unitPrice({ salePrice: 120, packSize: 1, packUnit: "dozen" })).toEqual({
      value: 10,
      per: "piece",
    });
  });
  it("returns null for loose goods or a bad pack size", () => {
    expect(unitPrice({ salePrice: 100, packSize: null, packUnit: null })).toBeNull();
    expect(unitPrice({ salePrice: 100, packSize: 0, packUnit: "kg" })).toBeNull();
  });
});

describe("discountPercent", () => {
  it("rounds a genuine discount", () => {
    expect(discountPercent({ salePrice: 80, compareAtPrice: 100 })).toBe(20);
  });
  it("is null when there is no genuine discount", () => {
    expect(discountPercent({ salePrice: 100, compareAtPrice: 100 })).toBeNull();
    expect(discountPercent({ salePrice: 100, compareAtPrice: null })).toBeNull();
    expect(discountPercent({ salePrice: 100, compareAtPrice: 90 })).toBeNull();
  });
});

describe("nextStatus", () => {
  it("advances along the fulfilment chain", () => {
    expect(nextStatus("placed")).toBe("confirmed");
    expect(nextStatus("packed")).toBe("out_for_delivery");
  });
  it("has no next step past delivered or off-chain", () => {
    expect(nextStatus("delivered")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
    expect(nextStatus("pending_payment")).toBeNull();
  });
});

describe("buildCategoryTree", () => {
  it("keeps only stocked departments and children", () => {
    const cats: Category[] = [
      { id: "d1", parentId: null, slug: "veg", name: "Veg", icon: null, productCount: 3 },
      { id: "c1", parentId: "d1", slug: "leafy", name: "Leafy", icon: null, productCount: 2 },
      { id: "c2", parentId: "d1", slug: "empty", name: "Empty", icon: null, productCount: 0 },
      { id: "d2", parentId: null, slug: "bare", name: "Bare", icon: null, productCount: 0 },
    ];
    const tree = buildCategoryTree(cats);
    expect(tree).toHaveLength(1);
    expect(tree[0].department.id).toBe("d1");
    expect(tree[0].children.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("deliveryFeeFor", () => {
  it("is free at or above the threshold, charged below it, free on an empty cart", () => {
    expect(deliveryFeeFor(600)).toBe(0);
    expect(deliveryFeeFor(300)).toBe(40);
    expect(deliveryFeeFor(0)).toBe(0);
  });
  it("respects custom thresholds and fees", () => {
    expect(deliveryFeeFor(300, 200, 25)).toBe(0);
    expect(deliveryFeeFor(100, 200, 25)).toBe(25);
  });
  it("property: any positive subtotal at/above the free threshold is never charged", () => {
    fc.assert(
      fc.property(fc.double({ min: FREE_DELIVERY_OVER, max: 1e7, noNaN: true }), (subtotal) => {
        expect(deliveryFeeFor(subtotal)).toBe(0);
      })
    );
  });
});
