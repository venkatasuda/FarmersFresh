import { test, expect } from "@playwright/test";

test("large search results stay paginated and later matches remain reachable", async ({ page }) => {
  await page.goto("/search?q=CI");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("250 results");
  await expect(page.locator("article")).toHaveCount(24);
  const firstPage = await page.locator("article h3").allTextContents();
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/q=CI&page=2/);
  await expect(page.locator("article")).toHaveCount(24);
  const nextPage = await page.locator("article h3").allTextContents();
  expect(nextPage.length).toBe(24);
  expect(nextPage.some(name => firstPage.includes(name))).toBe(false);
  await page.goto("/search?q=CI&page=999");
  await expect(page.getByText("Page 11 of 11", { exact: true })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(10);
  await expect(page.getByRole("link", { name: "Next page", exact: true })).toHaveCount(0);
});
