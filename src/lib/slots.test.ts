import assert from "node:assert/strict";
import test from "node:test";
import { accountOffersSlots, countOccupiedSlots, currentSlotSubscription, occupiesSlot } from "./slots.ts";

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
