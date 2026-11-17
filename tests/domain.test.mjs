import test from "node:test";
import assert from "node:assert/strict";
import releaseConfig from "../scripts/release-config.cjs";
import {
  available,
  dateKey,
  isDone,
  makeDemo,
  periodKey,
  periodStart,
  readStore,
  shiftPeriod,
  stats,
  streak,
  toggleTask,
  dailyActivity,
  yearActivity,
  monthCells,
} from "../src/domain.ts";
const date = (y, m, d) => new Date(y, m - 1, d, 12);
test("calendar distinguishes full, partial, missed, pending, future and unscheduled days", () => {
  const today = date(2026, 11, 8);
  const base = task("daily", "2026-11-02");
  const other = { ...base, id: "2" };
  assert.equal(dailyActivity([], today, today).status, "unscheduled");
  assert.equal(
    dailyActivity([base], date(2026, 11, 1), today).status,
    "unscheduled",
  );
  assert.equal(
    dailyActivity([base], date(2026, 11, 7), today).status,
    "missed",
  );
  assert.equal(dailyActivity([base], today, today).status, "pending");
  assert.equal(
    dailyActivity([toggleTask(base, today), other], today, today).status,
    "partial",
  );
  assert.equal(
    dailyActivity([toggleTask(base, today)], today, today).status,
    "complete",
  );
  assert.equal(
    dailyActivity(
      [toggleTask(base, date(2026, 11, 9))],
      date(2026, 11, 9),
      today,
    ).status,
    "future",
  );
  assert.equal(dailyActivity([task("weekly")], today, today).total, 0);
});
test("year activity handles leap days and counts daily completions without weekly duplication", () => {
  let daily = task("daily", "2024-01-01");
  for (const d of [28, 29]) daily = toggleTask(daily, date(2024, 2, d));
  const model = yearActivity(
    [daily, toggleTask(task("weekly", "2024-01-01"), date(2024, 2, 28))],
    2024,
    date(2024, 3, 1),
  );
  assert.equal(model.days.length, 366);
  assert.equal(model.completed, 2);
  assert.equal(model.activeDays, 2);
  assert.equal(model.longestStreak, 2);
  assert.equal(model.days.find((day) => day.key === "2024-02-29").level, 4);
});
test("calendar uses Monday columns and correct month boundaries", () => {
  const november = monthCells(2026, 10);
  assert.equal(november.length, 42);
  assert.equal(
    november.slice(0, 6).every((cell) => cell === null),
    true,
  );
  assert.equal(dateKey(november[6]), "2026-11-01");
  assert.equal(monthCells(2024, 1).filter(Boolean).length, 29);
});
test("store release rejects missing identity and placeholder URLs", () => {
  assert.equal(releaseConfig.validateReleaseEnvironment({}).length, 5);
  const env = {
    SLOWDAY_APP_ID: "org.testbrand.slowday",
    EXPO_PUBLIC_SUPPORT_EMAIL: "support@testbrand.org",
    EXPO_PUBLIC_PUBLISHER_NAME: "Test Publisher",
    EXPO_PUBLIC_PRIVACY_URL: "https://testbrand.org/privacy",
    EXPO_PUBLIC_SUPPORT_URL: "https://testbrand.org/support",
  };
  assert.deepEqual(releaseConfig.validateReleaseEnvironment(env), []);
  assert.equal(
    releaseConfig.validateReleaseEnvironment({
      ...env,
      SLOWDAY_APP_ID: "com.example.slowday",
      EXPO_PUBLIC_PRIVACY_URL: "http://localhost/privacy",
    }).length,
    2,
  );
});
const task = (frequency = "daily", createdAt = "2026-10-01") => ({
  id: "1",
  title: "閱讀",
  note: "",
  category: "學習",
  frequency,
  createdAt,
  completed: [],
});
test("weeks start Monday, including year boundary and Sunday", () => {
  assert.equal(dateKey(periodStart(date(2027, 1, 3), "weekly")), "2026-12-28");
  assert.equal(dateKey(periodStart(date(2027, 1, 4), "weekly")), "2027-01-04");
});
test("month shifting handles month-end and leap years", () => {
  assert.equal(
    dateKey(shiftPeriod(date(2024, 1, 31), "monthly", 1)),
    "2024-02-01",
  );
  assert.equal(
    dateKey(shiftPeriod(date(2024, 2, 29), "daily", 1)),
    "2024-03-01",
  );
  assert.equal(
    dateKey(shiftPeriod(date(2026, 12, 30), "monthly", 1)),
    "2027-01-01",
  );
});
test("completion resets by recurrence and toggle is reversible", () => {
  const done = toggleTask(task(), date(2026, 11, 8));
  assert.equal(isDone(done, date(2026, 11, 8)), true);
  assert.equal(isDone(done, date(2026, 11, 9)), false);
  assert.deepEqual(toggleTask(done, date(2026, 11, 8)).completed, []);
  const weekly = toggleTask(task("weekly"), date(2026, 11, 8));
  assert.equal(isDone(weekly, date(2026, 11, 2)), true);
  assert.equal(isDone(weekly, date(2026, 11, 9)), false);
  const monthly = toggleTask(task("monthly"), date(2026, 11, 8));
  assert.equal(isDone(monthly, date(2026, 11, 30)), true);
  assert.equal(isDone(monthly, date(2026, 12, 1)), false);
});
test("stats exclude tasks not yet created and other frequencies", () => {
  const tasks = [
    toggleTask(task(), date(2026, 11, 8)),
    { ...task(), id: "2" },
    task("weekly"),
    task("daily", "2026-11-09"),
  ];
  assert.deepEqual(stats(tasks, date(2026, 11, 8), "daily"), {
    total: 2,
    done: 1,
    remaining: 1,
    rate: 50,
  });
  assert.equal(
    available(task("monthly", "2026-11-30"), date(2026, 10, 31)),
    false,
  );
  assert.equal(
    available(task("weekly", "2026-11-08"), date(2026, 11, 2)),
    true,
  );
});
test("empty statistics are zero, never NaN", () => {
  assert.deepEqual(stats([], date(2026, 11, 8), "daily"), {
    total: 0,
    done: 0,
    remaining: 0,
    rate: 0,
  });
});
test("streak counts complete days and allows unfinished today", () => {
  const t = task();
  t.completed = [7, 6, 5].map((d) => periodKey(date(2026, 11, d), "daily"));
  assert.equal(streak([t], date(2026, 11, 8)), 3);
  assert.equal(
    streak([toggleTask(t, date(2026, 11, 8))], date(2026, 11, 8)),
    4,
  );
  assert.equal(streak([t, { ...task(), id: "2" }], date(2026, 11, 8)), 0);
});
test("persisted data roundtrips and malformed data is rejected", () => {
  const demo = makeDemo(date(2026, 11, 8));
  assert.deepEqual(readStore(JSON.stringify(demo)), demo);
  assert.throws(() => readStore("{bad"));
  assert.throws(() =>
    readStore(JSON.stringify({ version: 1, demo: false, tasks: [{}] })),
  );
});
