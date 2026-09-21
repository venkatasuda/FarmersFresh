import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Public-page smoke. Deliberately independent of seeded catalogue data so it is
// stable on a fresh CI database: it checks the app boots and the key public
// routes render, plus a baseline accessibility scan on the sign-in page.

test("home page responds", async ({ page }) => {
  const res = await page.goto("/");
  expect(res, "no response for /").toBeTruthy();
  expect(res!.status(), "home returned an error status").toBeLessThan(400);
});

test("login page renders a form", async ({ page }) => {
  const res = await page.goto("/login");
  expect(res!.status()).toBeLessThan(400);
  await expect(page.locator("input").first()).toBeVisible();
});

test("track page renders", async ({ page }) => {
  const res = await page.goto("/track");
  expect(res!.status()).toBeLessThan(400);
});

test("login page has no critical accessibility violations", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const critical = results.violations.filter((v) => v.impact === "critical");
  expect(critical, JSON.stringify(critical.map((v) => v.id))).toHaveLength(0);
});
