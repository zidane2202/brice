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
  const manifest = await response.json();
  expect(manifest.name).toBe("SubResell");
  expect(manifest.shortcuts).toEqual(expect.arrayContaining([expect.objectContaining({ url: "/clients?new=1" })]));
});

for (const viewport of [{ name: "mobile", width: 360, height: 740 }, { name: "tablette", width: 768, height: 1024 }, { name: "bureau", width: 1440, height: 900 }]) {
  test(`la page de connexion reste responsive sur ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/login");
    await expect(page.getByRole("heading")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("la santé applicative répond", async ({ request }) => {
  const response = await request.get("/api/health");
  expect([200, 503]).toContain(response.status());
  expect((await response.json()).status).toMatch(/ok|degraded/);
});
