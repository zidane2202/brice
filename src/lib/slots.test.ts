import assert from "node:assert/strict";
import test from "node:test";
import { accountOffersSlots, countOccupiedSlots, currentSlotSubscription, effectiveSubscription, occupiesSlot, paidBeyondAccount, withAccountRule } from "./slots.ts";

const today = "2026-10-05";

test("an expired subscription frees its slot", () => {
  assert.equal(occupiesSlot({ status: "active", end_date: "2026-10-05" }, today), true);
  assert.equal(occupiesSlot({ status: "active", end_date: "2026-09-04" }, today), false);
  assert.equal(occupiesSlot({ status: "cancelled", end_date: "2030-01-01" }, today), false);
});

test("grace keeps the slot until the grace date passes", () => {
  assert.equal(occupiesSlot({ status: "grace", end_date: "2026-09-01", grace_until: "2026-10-10" }, today), true);
  assert.equal(occupiesSlot({ status: "grace", end_date: "2026-09-01", grace_until: "2026-10-04" }, today), false);
  assert.equal(occupiesSlot({ status: "grace", end_date: "2026-09-01", grace_until: null }, today), true);
});

test("current subscription ignores expired ones on a resold slot", () => {
  const subs = [
    { id: "old", status: "active", end_date: "2026-07-20" },
    { id: "new", status: "active", end_date: "2026-11-27" },
  ];
  assert.equal(currentSlotSubscription(subs, today)?.id, "new");
  assert.equal(currentSlotSubscription([subs[0]], today), null);
});

test("each running client on a five-place account takes one place", () => {
  const slots = [
    { client_subscriptions: [{ status: "active", end_date: "2026-11-01" }] },
    { client_subscriptions: [{ status: "active", end_date: "2026-12-01" }] },
    { client_subscriptions: [{ status: "grace", end_date: "2026-09-30", grace_until: "2026-10-08" }] },
    { client_subscriptions: [{ status: "active", end_date: "2026-09-01" }] },
    { client_subscriptions: [] },
  ];
  assert.equal(countOccupiedSlots(slots, today), 3);
});

test("inactive or expired provider accounts offer no slots", () => {
  assert.equal(accountOffersSlots({ status: "active", end_date: "2026-11-01" }, today), true);
  assert.equal(accountOffersSlots({ status: "active", end_date: "2026-09-04" }, today), false);
  assert.equal(accountOffersSlots({ status: "inactive", end_date: "2026-11-01" }, today), false);
});

test("clients of an expired account are expired, even in grace", () => {
  const expiredAccount = { status: "active", end_date: "2026-10-01" };
  const grace = effectiveSubscription({ status: "grace", end_date: "2026-09-28", grace_until: "2026-10-12" }, expiredAccount, today);
  assert.equal(grace.status, "expired");
  assert.equal(grace.grace_until, null);
  assert.equal(occupiesSlot(grace, today), false);

  const paidLater = effectiveSubscription({ status: "active", end_date: "2026-11-20" }, expiredAccount, today);
  assert.equal(paidLater.status, "expired");
  assert.equal(paidLater.end_date, "2026-10-01");

  const disabled = effectiveSubscription({ status: "active", end_date: "2026-11-20" }, { status: "inactive", end_date: "2026-12-01" }, today);
  assert.equal(disabled.status, "expired");
});

test("renewing the account brings its clients back with their own dates", () => {
  const sub = { status: "active", end_date: "2026-11-20" };
  assert.deepEqual(effectiveSubscription(sub, { status: "active", end_date: "2026-11-01" }, today), sub);
  assert.equal(withAccountRule({ ...sub, slot: { account: { status: "active", end_date: "2026-12-01" } } }, today).status, "active");
  assert.equal(withAccountRule({ ...sub, slot: null }, today).status, "active");
  assert.equal(effectiveSubscription({ status: "cancelled", end_date: "2026-11-20" }, { status: "inactive", end_date: "2026-01-01" }, today).status, "cancelled");
});

test("flags clients paid beyond the account due date", () => {
  const account = { status: "active", end_date: "2026-10-20" };
  assert.equal(paidBeyondAccount({ status: "active", end_date: "2026-11-05" }, account, today), true);
  assert.equal(paidBeyondAccount({ status: "active", end_date: "2026-10-15" }, account, today), false);
  assert.equal(paidBeyondAccount({ status: "cancelled", end_date: "2026-11-05" }, account, today), false);
});
