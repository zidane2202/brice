import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  addMonths,
  civilDateInZone,
  firstOfMonthDateOnly,
  todayDateOnly,
  toDateInputValue,
} from "./dates.ts";

test("civilDateInZone follows the given timezone", () => {
  const instant = new Date("2026-08-10T02:30:00.000Z");
  assert.equal(civilDateInZone(instant, "UTC"), "2026-08-10");
  assert.equal(civilDateInZone(instant, "America/New_York"), "2026-08-09");
  assert.equal(civilDateInZone(instant, "Africa/Lagos"), "2026-08-10");
});

test("todayDateOnly uses Africa/Lagos not UTC midnight", () => {
  assert.equal(todayDateOnly(new Date("2026-08-09T23:30:00.000Z")), "2026-08-10");
});

test("toDateInputValue matches todayDateOnly", () => {
  const now = new Date("2026-01-05T01:00:00.000Z");
  assert.equal(toDateInputValue(now), todayDateOnly(now));
});

test("firstOfMonthDateOnly uses WAT civil month", () => {
  const now = new Date("2026-08-09T23:30:00.000Z");
  assert.equal(firstOfMonthDateOnly(now), "2026-08-01");
  assert.equal(firstOfMonthDateOnly(now, 1), "2026-07-01");
});

test("addDays stays on the calendar", () => {
  assert.equal(addDays("2026-08-10", 1), "2026-08-11");
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
});

test("addMonths clamps end-of-month instead of overflowing", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2026-08-10", 1), "2026-09-10");
});
