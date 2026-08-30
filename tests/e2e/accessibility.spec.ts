import { expect, test, type Page } from "@playwright/test";

async function skipUnlessPreview(page: Page) {
  if (await page.getByRole("heading", { name: "Your shared trip is private" }).isVisible().catch(() => false)) {
    test.skip(true, "Shared screens require an authenticated test account on configured deployments.");
  }
}

test("login controls are named and keyboard-focusable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back|join your shared trip|create your account/i })).toBeVisible();
  const email = page.getByLabel("Email address");
  if (await email.count()) {
    await expect(email).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await email.focus();
    await expect(email).toBeFocused();
  } else {
    await expect(page.getByText("Supabase setup needed")).toBeVisible();
    const previewLink = page.getByRole("link", { name: /continue with preview data/i });
    await expect(previewLink).toBeVisible();
    await previewLink.focus();
    await expect(previewLink).toBeFocused();
  }
});

test("shared screens expose accessible names for interactive controls", async ({ page }) => {
  for (const route of ["/today", "/plan", "/money", "/checklist", "/bookings", "/more"]) {
    await page.goto(route);
    await skipUnlessPreview(page);
    const unnamed = await page.locator("button, a[href], input, select, textarea").evaluateAll((elements) => elements.filter((element) => {
      const control = element as HTMLElement;
      if (control.hidden || control.getAttribute("aria-hidden") === "true") return false;
      const named = control.getAttribute("aria-label") || control.getAttribute("aria-labelledby") || control.getAttribute("title") || control.textContent?.trim();
      const labels = "labels" in control ? (control as HTMLInputElement).labels?.length : 0;
      const placeholder = control.getAttribute("placeholder");
      return !named && !labels && !placeholder;
    }).map((element) => element.outerHTML.slice(0, 180)));
    expect(unnamed, `${route} contains unnamed controls`).toEqual([]);
  }
});

test("dialogs trap focus, close with Escape, and restore the trigger", async ({ page }) => {
  await page.goto("/plan");
  await skipUnlessPreview(page);
  const trigger = page.getByRole("button", { name: "Add activity" });
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Add activity" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("primary mobile controls meet the 44px touch-target baseline", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only touch target audit.");
  await page.goto("/today");
  await skipUnlessPreview(page);
  const undersized = await page.locator(".bottom-nav a, .button, .button-like, .icon-button, .text-button, input, select, textarea").evaluateAll((elements) => elements.filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.height < 44;
  }).map((element) => ({ html: element.outerHTML.slice(0, 140), height: Math.round(element.getBoundingClientRect().height) })));
  expect(undersized).toEqual([]);
});
