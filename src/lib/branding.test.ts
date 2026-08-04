import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedLogoMime, resolveBrandLogoUrl, resolveBrandName } from "./branding.ts";

test("resolveBrandName prefers company_name", () => {
  assert.equal(resolveBrandName({ company_name: " Acme " }, "subresell"), "Acme");
});

test("resolveBrandName fallback", () => {
  assert.equal(resolveBrandName({ company_name: null }, "SnapFacture"), "SnapFacture");
  assert.equal(resolveBrandName({ company_name: "  " }, null), "subresell");
});

test("resolveBrandLogoUrl", () => {
  assert.equal(resolveBrandLogoUrl({ logo_url: "https://x/a.png" }), "https://x/a.png");
  assert.equal(resolveBrandLogoUrl({ logo_url: "  " }), null);
  assert.equal(resolveBrandLogoUrl({ logo_url: null }), null);
});

test("isAllowedLogoMime", () => {
  assert.equal(isAllowedLogoMime("image/png"), true);
  assert.equal(isAllowedLogoMime("image/jpeg"), true);
  assert.equal(isAllowedLogoMime("image/webp"), true);
  assert.equal(isAllowedLogoMime("application/pdf"), false);
});
