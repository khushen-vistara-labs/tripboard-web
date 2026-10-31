import { expect, test } from "@playwright/test";

for (const timezoneId of ["Asia/Kolkata", "UTC", "America/Los_Angeles"]) {
  test.describe(`booking clocks on a ${timezoneId} device`, () => {
    test.use({ timezoneId });

    test.beforeEach(async ({ page }) => {
      await page.goto("/bookings");
      if (await page.getByRole("heading", { name: "Your shared trip is private" }).isVisible().catch(() => false)) {
        test.skip(true, "Run against an unconfigured local demo, never real trip data.");
      }
      await expect(page.getByRole("button", { name: "Add record" })).toBeVisible();
      await expect(page.getByText("Preview data", { exact: true })).toBeVisible();
    });

    test("a 2 PM hotel remains 2 PM after saving and repeatedly editing", async ({ page }, testInfo) => {
      await page.getByRole("button", { name: "Add record" }).click();
      await page.getByLabel("Booking title").fill("Clock regression hotel");
      await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("HOTEL");
      await page.getByLabel("Date and time", { exact: true }).fill("2026-12-27T14:00");
      await page.getByLabel("Reference", { exact: true }).fill("CLOCK-TEST");
      await page.getByLabel("Amount", { exact: true }).fill("5910");
      // Two submit events in the same turn must still create only one record.
      await page.getByRole("dialog").locator("form").evaluate((form: HTMLFormElement) => {
        form.requestSubmit(); form.requestSubmit();
      });
      const card = page.locator(".booking-card").filter({ hasText: "Clock regression hotel" });
      await expect(card).toHaveCount(1);
      for (let cycle = 0; cycle < 3; cycle++) {
        await expect(card).toContainText(/Dec 27, 2026(?:,| at) 2:00 PM/);
        await page.getByRole("button", { name: "View Clock regression hotel", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("December 27, 2026 at 2:00 PM");
        await expect(dialog).toContainText("CLOCK-TEST");
        await expect(dialog).toContainText("INR 5910");
        if (cycle === 0 && timezoneId === "Asia/Kolkata") await page.screenshot({ path: testInfo.outputPath("booking-detail.png") });
        await dialog.getByRole("button", { name: "Edit", exact: true }).click();
        await expect(page.getByLabel("Date and time", { exact: true })).toHaveValue("2026-12-27T14:00");
        if (cycle === 0 && timezoneId === "Asia/Kolkata") await page.screenshot({ path: testInfo.outputPath("booking-edit.png") });
        await page.getByRole("textbox", { name: /^Notes/ }).fill(`Unrelated edit ${cycle}`);
        await page.getByRole("button", { name: "Save booking", exact: true }).click();
      }
      await expect(card).toHaveCount(1);
      await expect(card).toContainText(/Dec 27, 2026(?:,| at) 2:00 PM/);
      if (timezoneId === "Asia/Kolkata") await page.screenshot({ path: testInfo.outputPath("booking-list.png") });
    });

    test("editing an existing booking preserves its clock and permits a midnight change", async ({ page }) => {
      await page.getByRole("button", { name: "View Ngong Ping 360", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Edit", exact: true }).click();
      await expect(page.getByLabel("Date and time", { exact: true })).toHaveValue("2026-12-28T09:30");
      await page.getByLabel("Date and time", { exact: true }).fill("2026-12-27T00:15");
      await page.getByRole("button", { name: "Save booking", exact: true }).click();
      await expect(page.locator(".booking-card").filter({ hasText: "Ngong Ping 360" })).toContainText(/Dec 27, 2026(?:,| at) 12:15 AM/);
      await page.getByRole("button", { name: "View Ngong Ping 360", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Edit", exact: true }).click();
      await expect(page.getByLabel("Date and time", { exact: true })).toHaveValue("2026-12-27T00:15");
      await page.getByRole("button", { name: "Save booking", exact: true }).click();
      await expect(page.locator(".booking-card").filter({ hasText: "Ngong Ping 360" })).toContainText(/Dec 27, 2026(?:,| at) 12:15 AM/);
    });

    test("a document's relevant date stays unchanged after editing", async ({ page }) => {
      await page.getByRole("button", { name: "Add record" }).click();
      await page.getByRole("button", { name: "Document / file", exact: true }).click();
      await page.getByLabel("Document name").fill("Clock regression document");
      await page.getByLabel(/Relevant date/).fill("2027-03-20");
      await page.getByRole("button", { name: "Save document", exact: true }).click();
      for (let cycle = 0; cycle < 2; cycle++) {
        const card = page.locator(".booking-card").filter({ hasText: "Clock regression document" });
        await expect(card).toContainText("Mar 20, 2027");
        await page.getByRole("button", { name: "View Clock regression document", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("March 20, 2027");
        await page.getByRole("dialog").getByRole("button", { name: "Edit", exact: true }).click();
        await expect(page.getByLabel(/Relevant date/)).toHaveValue("2027-03-20");
        await page.getByRole("textbox", { name: /^Notes/ }).fill(`Unrelated document edit ${cycle}`);
        await page.getByRole("button", { name: "Save document", exact: true }).click();
      }
    });
  });
}
