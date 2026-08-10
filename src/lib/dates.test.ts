import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  addMonths,
  firstOfMonthDateOnly,
  todayDateOnly,
  toDateInputValue,
} from "./dates.ts";

test("toDateInputValue uses local civil date", () => {
  assert.equal(toDateInputValue(new Date(2026, 7, 10, 23, 30, 0)), "2026-08-10");
});

test("todayDateOnly matches toDateInputValue", () => {
  const now = new Date(2026, 0, 5, 1, 0, 0);
  assert.equal(todayDateOnly(now), "2026-01-05");
});

test("firstOfMonthDateOnly does not shift via UTC ISO", () => {
  const now = new Date(2026, 7, 10, 0, 30, 0);
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
