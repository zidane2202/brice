import assert from "node:assert/strict";
import test from "node:test";
import {
  accountCap,
  clientsPerAccount,
  normalizePlan,
  parsePlanLimitError,
  PLAN_LIMIT_ACCOUNT,
  activatePlanFor30Days,
  planLimitError,
  accountCapFor,
  clientsPerAccountFor,
  effectivePlan,
  canUseFullCompta,
  canUsePush,
  canUseBranding,
  ADMIN_UNLIMITED,
  isPlanExpired,
  isTrialActive,
  trialEndsOn,
} from "./plans.ts";

test("a paid pack becomes read-only once its renewal date has passed", () => {
  const today = "2026-10-05";
  assert.equal(isPlanExpired({ plan: "pro", plan_renews_on: "2026-10-04" }, today), true);
  assert.equal(isPlanExpired({ plan: "business", plan_renews_on: "2026-09-01" }, today), true);
  assert.equal(isPlanExpired({ plan: "pro", plan_renews_on: "2026-10-05" }, today), false);
  assert.equal(isPlanExpired({ plan: "pro", plan_renews_on: null }, today), false);
  assert.equal(isPlanExpired({ plan: "pro", role: "admin", plan_renews_on: "2026-01-01" }, today), false);
  assert.equal(isPlanExpired(null, today), false);
});

test("free is a 7-day trial with Pro features, then read-only", () => {
  const today = "2026-10-05";
  const trial = { plan: "free", plan_renews_on: "2026-10-08" };
  assert.equal(isTrialActive(trial, today), true);
  assert.equal(effectivePlan(trial, today), "pro");
  assert.equal(accountCapFor(trial, today), accountCap("pro"));
  assert.equal(clientsPerAccountFor(trial, today), clientsPerAccount("pro"));
  assert.equal(isPlanExpired(trial, today), false);

  const ended = { plan: "free", plan_renews_on: "2026-10-04" };
  assert.equal(isTrialActive(ended, today), false);
  assert.equal(effectivePlan(ended, today), "free");
  assert.equal(isPlanExpired(ended, today), true);

  assert.equal(trialEndsOn({ plan: "free", created_at: "2026-10-01T10:00:00Z" }), "2026-10-08");
  assert.equal(trialEndsOn({ plan: "pro", plan_renews_on: "2026-10-08" }), null);
});

test("admins get every feature with no limits, whatever their stored plan", () => {
  const admin = { role: "admin", plan: "free", extra_provider_accounts: 0 };
  assert.equal(effectivePlan(admin), "business");
  assert.ok(canUseFullCompta(effectivePlan(admin)));
  assert.ok(canUsePush(effectivePlan(admin)));
  assert.ok(canUseBranding(effectivePlan(admin)));
  assert.equal(accountCapFor(admin), ADMIN_UNLIMITED);
  assert.equal(clientsPerAccountFor(admin), ADMIN_UNLIMITED);
});

test("resellers keep their plan limits", () => {
  const free = { role: "reseller", plan: "free" };
  assert.equal(effectivePlan(free), "free");
  assert.equal(accountCapFor(free), 2);
  assert.equal(clientsPerAccountFor(free), 3);
  assert.equal(accountCapFor({ role: "reseller", plan: "pro", extra_provider_accounts: 3 }), 18);
  assert.equal(effectivePlan(null), "free");
});

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
  const { extendPlanRenewal } = await import("./plans.ts");
  assert.equal(extendPlanRenewal(null, "2026-08-01"), "2026-08-31");
  assert.equal(extendPlanRenewal("2026-10-01", "2026-08-01"), "2026-10-31");
  assert.equal(extendPlanRenewal("2026-07-01", "2026-08-01"), "2026-08-31");
});

test("extras are billed monthly, packs of 3 first", async () => {
  const { extrasMonthlyFcfa, monthlyDueFcfa, estimateMrrFcfa } = await import("./plans.ts");
  assert.equal(extrasMonthlyFcfa(0), 0);
  assert.equal(extrasMonthlyFcfa(1), 2_000);
  assert.equal(extrasMonthlyFcfa(3), 5_000);
  assert.equal(extrasMonthlyFcfa(4), 7_000);
  assert.equal(monthlyDueFcfa("pro", 3), 15_000);
  assert.equal(monthlyDueFcfa("business", 3), 22_500);
  assert.equal(monthlyDueFcfa("free", 3), 0);
  assert.equal(estimateMrrFcfa("pro", 3, true), 0);
});

test("activatePlanFor30Days", () => {
  assert.equal(activatePlanFor30Days("2026-02-01"), "2026-03-03");
});
