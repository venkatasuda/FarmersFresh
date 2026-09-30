import { test, expect } from "@playwright/test";

test("storefront navigation preserves the basket and staff pages use their own shell", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("ff.cart.v1", JSON.stringify([{
    productId: "33333333-3333-4333-8333-333333333333",
    slug: "architecture-item", name: "Architecture basket item", unit: "piece",
    price: 100, imagePath: null, quantity: 1, packLabel: null, step: 1,
  }])));
  await page.goto("/cart");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("main").getByText("Architecture basket item", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Recipes", exact: true }).first().click();
  await expect(page).toHaveURL(/\/recipes$/);
  await page.getByRole("button", { name: /Basket/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Your basket" })
    .getByText("Architecture basket item", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close basket" }).click();
  await page.getByRole("link", { name: "Staff sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /Basket/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});
