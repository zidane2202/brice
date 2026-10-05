import assert from "node:assert/strict";
import test from "node:test";
import { countOccupiedSlots, currentSlotSubscription, occupiesSlot } from "./slots.ts";

test("overdue active subscription still occupies its slot", () => {
  assert.equal(occupiesSlot({ status: "active" }), true);
  assert.equal(occupiesSlot({ status: "grace" }), true);
  assert.equal(occupiesSlot({ status: "cancelled" }), false);
});

test("current subscription is the occupying one with the latest end date", () => {
  const subs = [
    { id: "old", status: "active", end_date: "2026-07-20" },
    { id: "new", status: "active", end_date: "2026-09-27" },
    { id: "gone", status: "cancelled", end_date: "2026-12-01" },
  ];
  assert.equal(currentSlotSubscription(subs)?.id, "new");
  assert.equal(currentSlotSubscription([{ id: "x", status: "cancelled", end_date: "2026-01-01" }]), null);
  assert.equal(currentSlotSubscription(undefined), null);
});

test("five clients on a five-place account count as five, even when overdue", () => {
  const slots = [
    { client_subscriptions: [{ status: "active", end_date: "2026-07-22" }] },
    { client_subscriptions: [{ status: "active", end_date: "2026-08-19" }] },
    { client_subscriptions: [{ status: "active", end_date: "2026-07-08" }] },
    { client_subscriptions: [{ status: "grace", end_date: "2026-06-13" }] },
    { client_subscriptions: [{ status: "active", end_date: "2030-01-01" }] },
  ];
  assert.equal(countOccupiedSlots(slots), 5);
  assert.equal(countOccupiedSlots([{ client_subscriptions: [{ status: "cancelled", end_date: "2030-01-01" }] }, { client_subscriptions: [] }]), 0);
});
