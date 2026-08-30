import { expect, test } from "@playwright/test";

test("today plan is actionable and shared completion updates optimistically", async ({ page }) => {
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Ngong Ping 360" })).toBeVisible();
  await page.getByRole("button", { name: /mark done/i }).click();
  await expect(page.getByRole("heading", { name: "Tian Tan Buddha" })).toBeVisible();
});

test("money keeps outflow, local consumption, and balances separate", async ({ page }) => {
  await page.goto("/money");
  await expect(page.getByText("No double-counting.")).toBeVisible();
  await expect(page.getByText("OWN MONEY OUTFLOW")).toBeVisible();
  await expect(page.getByText("LOCAL CONSUMPTION")).toBeVisible();
  await expect(page.getByText("MONEY STILL AVAILABLE")).toBeVisible();
});

test("ordinary wallet purchase is recorded without a negative wallet", async ({ page }) => {
  await page.goto("/money");
  await page.getByRole("button", { name: /add money activity/i }).click();
  await page.getByRole("button", { name: /^Purchase/ }).click();
  await page.getByLabel("Paid / moved from").selectOption({ label: "Octopus 1" });
  await page.getByLabel("Amount").fill("14");
  await page.getByLabel("Description").fill("MTR test ride");
  await page.getByRole("button", { name: /record activity/i }).click();
  await expect(page.getByText("MTR test ride")).toBeVisible();
});

test("food completion is explicit", async ({ page }) => {
  await page.goto("/checklist?kind=FOOD");
  await expect(page.getByText("Important foods still not tried")).toBeVisible();
  await page.getByRole("button", { name: /mark complete: egg waffle/i }).click();
  await expect(page.getByText("Egg waffle")).toBeVisible();
});

test("booking wallet surfaces private ticket state", async ({ page }) => {
  await page.goto("/bookings");
  await expect(page.getByRole("heading", { name: "Ngong Ping 360" })).toBeVisible();
  await expect(page.getByText("Cable car tickets.pdf")).toBeVisible();
});
