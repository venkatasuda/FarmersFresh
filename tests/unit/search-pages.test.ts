import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SearchPageView } from "@/features/search/search-view";
import type { ShopProduct } from "@/lib/types";

vi.mock("@/features/shop/product-card", async () => {
  const { createElement } = await import("react");
  return { ProductCard: ({ product }: { product: ShopProduct }) => createElement("article", { "data-id": product.id }) };
});
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return { default: ({ href, children }: { href: string; children: import("react").ReactNode }) => createElement("a", { href }, children) };
});
const results = Array.from({ length: 52 }, (_, id) => ({ id: String(id) })) as ShopProduct[];
const render = (page?: string) => renderToStaticMarkup(createElement(SearchPageView, { term: "rice & dal", q: "rice & dal", results, page }));
const ids = (html: string) => [...html.matchAll(/data-id="(\d+)"/g)].map(match => Number(match[1]));
describe("search result pages", () => {
  it("keeps all matches reachable exactly once while bounding each page and preserving the query", () => {
    const pages = [render(), render("2"), render("3")];
    expect(pages.map(html => ids(html).length)).toEqual([24, 24, 4]);
    expect(pages.flatMap(ids)).toEqual(Array.from({ length: 52 }, (_, i) => i));
    expect(pages[0]).toContain("52 results");
    expect(pages[0]).toContain("/search?q=rice+%26+dal&amp;page=2");
    expect(pages[0]).not.toContain("Previous page");
    expect(pages[2]).not.toContain("Next page");
  });
  it("handles malformed, zero and out-of-range page values without losing matches", () => {
    for (const page of ["0", "-1", "NaN", "2.5", "9007199254740992"]) expect(ids(render(page))).toEqual(ids(render()));
    expect(ids(render("999"))).toEqual([48, 49, 50, 51]);
  });
});
