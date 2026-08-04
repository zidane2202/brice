import assert from "node:assert/strict";
import test from "node:test";
import {
  accountCap,
  clientsPerAccount,
  normalizePlan,
  parsePlanLimitError,
  PLAN_LIMIT_ACCOUNT,
  planLimitError,
} from "./plans";

test("normalizePlan", () => {
  assert.equal(normalizePlan("pro"), "pro");
  assert.equal(normalizePlan("business"), "business");
  assert.equal(normalizePlan("free"), "free");
  assert.equal(normalizePlan(null), "free");
});

test("accountCap free/pro/extras", () => {
  assert.equal(accountCap("free", 10), 2);
  assert.equal(accountCap("pro", 0), 15);
  assert.equal(accountCap("pro", 3), 18);
  assert.equal(accountCap("business", 0), 500);
});

test("clientsPerAccount", () => {
  assert.equal(clientsPerAccount("free"), 3);
  assert.equal(clientsPerAccount("pro"), 5);
});

test("parsePlanLimitError", () => {
  const err = planLimitError(PLAN_LIMIT_ACCOUNT, "Trop de comptes");
  const parsed = parsePlanLimitError(err.message);
  assert.deepEqual(parsed, { code: PLAN_LIMIT_ACCOUNT, message: "Trop de comptes" });
  assert.equal(parsePlanLimitError("autre"), null);
});

test("extendPlanRenewal", async () => {
  const { extendPlanRenewal } = await import("./plans");
  assert.equal(extendPlanRenewal(null, "2026-08-01", 1), "2026-09-01");
  assert.equal(extendPlanRenewal("2026-10-01", "2026-08-01", 1), "2026-11-01");
  assert.equal(extendPlanRenewal("2026-07-01", "2026-08-01", 1), "2026-09-01");
});
