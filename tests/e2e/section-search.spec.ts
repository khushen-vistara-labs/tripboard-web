import { expect, test, type Page } from "@playwright/test";

async function openPreview(page: Page, route: string) {
  await page.goto(route);
  await page.locator(".loading-screen").waitFor({ state: "hidden" });
  if (await page.getByRole("heading", { name: "Your shared trip is private" }).isVisible()) {
    test.skip(true, "Search fixtures require preview mode or a dedicated authenticated test trip.");
  }
}

async function searchSection(page: Page, scope: string, query: string) {
  await page.getByRole("button", { name: `Search ${scope}`, exact: true }).click();
  const input = page.getByRole("searchbox", { name: `Search ${scope}`, exact: true });
  await expect(input).toBeFocused();
  await input.fill(query);
  return page.getByRole("region", { name: `${scope} search results`, exact: true });
}

test("Plan search expands on demand, searches other days and preserves the day filter", async ({ page }) => {
  await openPreview(page, "/plan");
  await expect(page.getByRole("searchbox", { name: "Search Plan", exact: true })).toBeHidden();
  await page.getByPlaceholder("Search this day").fill("Ngong");
  const results = await searchSection(page, "Plan", "TJ-093842");
  await expect(results.getByRole("heading", { name: "Ferry to Macau" })).toBeVisible();
  await expect(results.getByText("30 Dec 2026", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear section search" }).click();
  await expect(page.getByPlaceholder("Search this day")).toHaveValue("Ngong");
  await expect(page.getByRole("heading", { name: "Ngong Ping 360", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Plan", exact: true }).fill("TJ-093842");
  await results.getByRole("link", { name: "View activity in Plan" }).click();
  await expect(page.locator("#itinerary-ferry")).toBeFocused();
  await expect(page.getByRole("heading", { name: "Ferry to Macau" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("overview search finds transport subtext omitted from the day cards", async ({ page }) => {
  await openPreview(page, "/overview");
  const results = await searchSection(page, "Trip at a Glance", "Exit B");
  await expect(results.getByRole("heading", { name: "Ngong Ping 360" })).toBeVisible();
  await expect(results.locator(".section-search-matches").getByText(/MTR to Tung Chung/)).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Trip at a Glance" }).press("Escape");
  await expect(page.getByRole("region", { name: "Complete trip overview" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Trip at a Glance" }).press("Escape");
  await expect(page.getByRole("button", { name: "Search Trip at a Glance", exact: true })).toHaveAttribute("aria-expanded", "false");
});

test("Money search finds merchants and accounts and restores history filters", async ({ page }) => {
  await openPreview(page, "/money");
  await page.getByLabel("Search money history", { exact: true }).fill("MTR");
  const results = await searchSection(page, "Money", "Australia Dairy Company");
  await expect(results.getByRole("heading", { name: "Breakfast", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Money", exact: true }).fill("Octopus 1");
  await expect(results.getByRole("heading", { name: "Octopus 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close Money search" }).click();
  await expect(page.getByLabel("Search money history", { exact: true })).toHaveValue("MTR");
});

test("Guide search finds newly entered notes and renders punctuation safely", async ({ page }) => {
  await openPreview(page, "/guide");
  await page.getByRole("button", { name: "Add reference", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").selectOption("__new_category__");
  await dialog.getByRole("textbox", { name: "New category", exact: true }).fill("Shopping");
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("A quiet stop");
  await dialog.getByRole("textbox", { name: "More detail", exact: true }).fill("Find the bakery on Mandarin Street. Ask for the pineapple bun.");
  await dialog.getByRole("button", { name: "Save reference", exact: true }).click();
  const results = await searchSection(page, "Trip Guide", "Mandarin Street");
  await expect(results.getByRole("heading", { name: "A quiet stop" })).toBeVisible();
  await expect(results.locator(".section-search-matches").getByText(/Find the bakery/)).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Trip Guide", exact: true }).fill("[.*");
  await expect(results.getByRole("heading", { name: "No matches in Trip Guide" })).toBeVisible();
});

test("all menu sections expose the same collapsible search without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const [route, scope] of [["/today", "Today"], ["/plan", "Plan"], ["/overview", "Trip at a Glance"], ["/money", "Money"], ["/checklist", "Checklist"], ["/guide", "Trip Guide"], ["/immigration", "Immigration"], ["/more", "More"], ["/bookings", "Documents & files"]]) {
    await openPreview(page, route);
    await searchSection(page, scope, "a-very-long-street-name-with-no-matching-place-in-this-trip");
    const metrics = await page.locator("html").evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    expect(metrics.scroll, `${scope} overflows on mobile`).toBeLessThanOrEqual(metrics.width);
    const trigger = page.getByRole("button", { name: `Close ${scope} search`, exact: true });
    const box = await trigger.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    await expect(page.getByRole("searchbox", { name: `Search ${scope}`, exact: true })).toBeHidden();
  }
});
