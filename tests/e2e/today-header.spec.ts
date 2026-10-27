import { expect, test, type Page } from "@playwright/test";

async function openToday(page: Page) {
  await page.goto("/today");
  await page.locator(".loading-screen").waitFor({ state: "hidden" });
  if (await page.getByRole("heading", { name: "Your shared trip is private" }).isVisible()) test.skip(true, "Requires preview mode or a dedicated authenticated test trip.");
}

test("Today search stays beside notifications and profile when closed, expanded, and searching", async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await openToday(page);
    const actions = page.locator(".today-topbar .top-actions");
    await expect(actions.getByRole("button", { name: "Search Today", exact: true })).toBeVisible();
    const checkAlignment = async () => {
      const boxes = await Promise.all([actions.locator(".section-search-control").boundingBox(), actions.locator(".notification-button").boundingBox(), actions.locator(".avatar").boundingBox()]);
      const centres = boxes.map((box) => box!.y + box!.height / 2);
      expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(1);
      const metrics = await page.locator("html").evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }));
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
    };
    await checkAlignment();
    await actions.getByRole("button", { name: "Search Today", exact: true }).click();
    const search = page.getByRole("searchbox", { name: "Search Today", exact: true });
    await expect(search).toBeFocused();
    await checkAlignment();
    await search.fill("Tung Chung");
    await expect(page.getByRole("region", { name: "Today search results" }).getByRole("heading", { name: "Ngong Ping 360" })).toBeVisible();
    await checkAlignment();
    await expect(page.locator(".section-search-control")).toHaveCount(1);
  }
});

test("greeting follows Hong Kong time and changes while Today stays open", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-12-28T03:59:30Z") });
  await openToday(page);
  await expect(page.getByRole("heading", { name: "Good morning", exact: true })).toBeVisible();
  await page.clock.fastForward(30_000);
  await expect(page.getByRole("heading", { name: "Good afternoon", exact: true })).toBeVisible();
  await page.clock.fastForward(5 * 60 * 60 * 1000);
  await expect(page.getByRole("heading", { name: "Good evening", exact: true })).toBeVisible();
});
