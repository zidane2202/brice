import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppliedExtras } from "./platform-payments.ts";

test("pro monthly renewal keeps purchased extras", () => {
  assert.equal(
    resolveAppliedExtras({
      kind: "pro_monthly",
      applyPlan: true,
      currentExtras: 3,
      requestedExtras: 0,
      targetPlan: "pro",
    }),
    3
  );
});

test("extra_accounts adds to current extras", () => {
  assert.equal(
    resolveAppliedExtras({
      kind: "extra_accounts",
      applyPlan: true,
      currentExtras: 2,
      requestedExtras: 3,
      targetPlan: "pro",
    }),
    5
  );
});

test("business monthly clears extras", () => {
  assert.equal(
    resolveAppliedExtras({
      kind: "business_monthly",
      applyPlan: true,
      currentExtras: 4,
      requestedExtras: 0,
      targetPlan: "business",
    }),
    0
  );
});

test("cash-only other does not change extras", () => {
  assert.equal(
    resolveAppliedExtras({
      kind: "other",
      applyPlan: false,
      currentExtras: 4,
      requestedExtras: 0,
      targetPlan: "pro",
    }),
    4
  );
});
