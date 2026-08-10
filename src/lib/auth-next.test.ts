import assert from "node:assert/strict";
import test from "node:test";
import { safeAuthNextPath } from "./auth-next.ts";

test("safeAuthNextPath allows reset and dashboard only", () => {
  assert.equal(safeAuthNextPath("/reset-password"), "/reset-password");
  assert.equal(safeAuthNextPath("/dashboard"), "/dashboard");
  assert.equal(safeAuthNextPath("//evil.com"), "/dashboard");
  assert.equal(safeAuthNextPath("https://evil.com"), "/dashboard");
  assert.equal(safeAuthNextPath("/abonnements"), "/dashboard");
});
