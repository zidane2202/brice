import { expect, test } from "@playwright/test";

test("la connexion est utilisable au clavier", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await expect(page.getByRole("button", { name: /connexion|connecter/i })).toBeVisible();
});

test("le manifeste PWA est disponible", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).name).toBe("SubResell");
});

test("la santé applicative répond", async ({ request }) => {
  const response = await request.get("/api/health");
  expect([200, 503]).toContain(response.status());
  expect((await response.json()).status).toMatch(/ok|degraded/);
});
