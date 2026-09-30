import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

describe("architecture migration", () => {
  it("preserves all page URLs without collisions", () => {
    const routes = files("src/app").filter((file) => file.endsWith("page.tsx"))
      .map((file) => "/" + relative("src/app", file).replaceAll("\\", "/")
        .replace(/\/?page\.tsx$/, "").split("/")
        .filter((segment) => segment && !segment.startsWith("(")).join("/"));
    const expected = [
      "/", "/about", "/account", "/account/login", "/account/signup", "/cart",
      "/checkout", "/collections/[slug]", "/contact", "/dashboard",
      "/dashboard/banners", "/dashboard/catalogue", "/dashboard/catalogue/[id]",
      "/dashboard/catalogue/new", "/dashboard/coldchain", "/dashboard/coupons",
      "/dashboard/credit", "/dashboard/credit/[id]", "/dashboard/deliveries",
      "/dashboard/delivery", "/dashboard/expiry", "/dashboard/financials",
      "/dashboard/orders", "/dashboard/pos", "/dashboard/production",
      "/dashboard/purchasing", "/dashboard/recipes", "/dashboard/reorder",
      "/dashboard/returns", "/dashboard/sales", "/dashboard/settings",
      "/dashboard/stock", "/dashboard/support", "/dashboard/traceability",
      "/dashboard/wastage", "/delivery-info", "/hampers", "/help", "/login",
      "/offers", "/offline", "/order-placed", "/pass", "/privacy", "/receipt",
      "/recipes", "/returns", "/search", "/shop/[slug]", "/terms", "/track", "/wishlist",
    ];
    expect(routes.sort()).toEqual(expected.sort());
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("keeps storefront state out of the shared root layout", () => {
    const root = readFileSync("src/app/layout.tsx", "utf8");
    expect(root).not.toMatch(/CartProvider|WishlistProvider|getStoreSettings|ServiceWorkerRegister/);
    const shell = readFileSync("src/features/shop/storefront-shell.tsx", "utf8");
    expect(shell).toMatch(/<CartProvider/);
    expect(shell).toMatch(/<WishlistProvider/);
  });
});
