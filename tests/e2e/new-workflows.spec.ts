import { expect, test, type Page } from "@playwright/test";

async function openPreview(page: Page, route: string) {
  await page.goto(route);
  if (await page.getByRole("heading", { name: "Your shared trip is private" }).isVisible().catch(() => false)) {
    test.skip(true, "Run with a dedicated authenticated E2E account when Supabase is configured.");
  }
}

test("travellers can add a fully linked itinerary activity", async ({ page }) => {
  await openPreview(page, "/plan");
  await page.getByRole("button", { name: "Add activity" }).click();
  await page.getByLabel("Activity title").fill("Accessible harbour walk");
  await page.getByLabel("Linked place").selectOption({ index: 1 });
  await page.getByLabel("Linked booking").selectOption({ index: 1 });
  await page.getByLabel("Linked checklist item").selectOption({ index: 1 });
  await page.getByLabel(/Notes and travel details/).fill("Meet beside the ferry pier.");
  await page.getByRole("button", { name: "Add activity", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Accessible harbour walk" })).toBeVisible();
});

test("place and booking forms save their complete detail fields", async ({ page }) => {
  await openPreview(page, "/more?section=places");
  await page.getByRole("button", { name: "Add place" }).click();
  await page.getByLabel("Place name").fill("E2E promenade");
  await page.getByLabel("Category").fill("Walk");
  await page.getByLabel("Neighbourhood").fill("Tsim Sha Tsui");
  await page.getByLabel("Expected duration (minutes)").fill("45");
  await page.getByLabel("Shared notes").fill("Step-free route available.");
  await page.getByRole("button", { name: "Add place", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "E2E promenade" })).toBeVisible();

  await page.goto("/bookings");
  await page.getByRole("button", { name: "Add booking" }).click();
  await page.getByLabel("Booking title").fill("E2E ferry");
  await page.getByLabel("Provider").fill("Test operator");
  await page.getByLabel("Reference").fill("E2E-REF-1");
  await page.getByLabel(/Travellers/).fill("Owner, Member");
  await page.getByLabel("Amount").fill("120");
  await page.getByLabel("Notes").fill("Arrive 20 minutes early.");
  await page.getByRole("button", { name: "Add booking", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "E2E ferry" })).toBeVisible();
});

test("checklist metadata and budgets are editable through real forms", async ({ page }) => {
  await openPreview(page, "/checklist");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Title").fill("E2E snack stop");
  await page.getByLabel("Kind").selectOption("FOOD");
  await page.getByLabel("Target count").fill("2");
  await page.getByLabel("Rating").selectOption("5");
  await page.getByLabel("Favourite").check();
  await page.getByLabel("Notes").fill("Try both flavours.");
  await page.getByRole("button", { name: "Add item", exact: true }).last().click();
  await expect(page.getByText("E2E snack stop")).toBeVisible();

  await page.goto("/money#budgets");
  await page.getByRole("button", { name: "Add budget" }).click();
  await page.getByLabel("Budget amount").fill("800");
  await page.getByRole("button", { name: "Add budget", exact: true }).last().click();
  await expect(page.getByText(/800\.00/).first()).toBeVisible();
});
