import { test } from "node:test";
import assert from "node:assert/strict";
import { businessDate, currentPayPeriod, isPastMidnight, mondayOf, missingNights, payPeriod, periodForPayday, upcomingPayday, closedWeekdays } from "./payroll.ts";

test("a Mon–Sun week is paid on the Friday two weeks after it starts", () => {
  assert.deepEqual(payPeriod("2026-10-26"), { weekStart: "2026-10-26", weekEnd: "2026-11-01", payday: "2026-11-13" });
  // Any day in the week maps to the same period.
  assert.deepEqual(payPeriod("2026-10-29"), payPeriod("2026-10-26"));
  assert.deepEqual(periodForPayday("2026-11-13").weekStart, "2026-10-26");
});

test("the upcoming payday is the next Friday, or today on a Friday", () => {
  assert.equal(upcomingPayday("2026-11-01"), "2026-11-06"); // Sunday
  assert.equal(upcomingPayday("2026-11-05"), "2026-11-06"); // Thursday
  assert.equal(upcomingPayday("2026-11-06"), "2026-11-06"); // Friday
  assert.equal(upcomingPayday("2026-11-07"), "2026-11-13"); // Saturday
});

test("this Friday pays the week that started 18 days earlier", () => {
  assert.deepEqual(currentPayPeriod("2026-11-05"), { weekStart: "2026-10-19", weekEnd: "2026-10-25", payday: "2026-11-06" });
});

test("pay weeks across a DST change and a year end stay Mon–Sun", () => {
  assert.deepEqual(payPeriod("2026-11-02"), { weekStart: "2026-11-02", weekEnd: "2026-11-08", payday: "2026-11-20" });
  assert.deepEqual(payPeriod("2026-12-30"), { weekStart: "2026-12-28", weekEnd: "2027-01-03", payday: "2027-01-15" });
});

test("missing nights skip saved days, closed days and days that haven't happened", () => {
  const period = { from: "2026-10-26", to: "2026-11-01" };
  const saved = ["2026-10-27", "2026-10-28", "2026-10-30", "2026-10-31"];
  assert.deepEqual(missingNights(period, saved, "2026-11-10", closedWeekdays("mon")), ["2026-10-29", "2026-11-01"]);
  assert.deepEqual(missingNights(period, saved, "2026-10-30", closedWeekdays("")), ["2026-10-26", "2026-10-29"]);
});

test("a shift saved between midnight and 4am belongs to the night before", () => {
  const ny = "America/New_York";
  // Tue Nov 3 2026, 12:45am in New York is still Monday's shift.
  assert.equal(businessDate(ny, new Date("2026-11-03T05:45:00Z")), "2026-11-02");
  assert.equal(isPastMidnight(ny, new Date("2026-11-03T05:45:00Z")), true);
  // 3:59am is the last minute of the night; 4:00am starts the new day.
  assert.equal(businessDate(ny, new Date("2026-11-03T08:59:00Z")), "2026-11-02");
  assert.equal(businessDate(ny, new Date("2026-11-03T09:00:00Z")), "2026-11-03");
  assert.equal(isPastMidnight(ny, new Date("2026-11-03T09:00:00Z")), false);
  // An evening save is the same calendar day.
  assert.equal(businessDate(ny, new Date("2026-11-03T03:30:00Z")), "2026-11-02"); // Mon 10:30pm
});

test("the business day holds across month, year and DST boundaries", () => {
  const ny = "America/New_York";
  assert.equal(businessDate(ny, new Date("2026-12-01T06:00:00Z")), "2026-11-30"); // Tue Dec 1, 1am
  assert.equal(businessDate(ny, new Date("2027-01-01T07:30:00Z")), "2026-12-31"); // New Year's, 2:30am
  // Clocks fell back at 2am on Sun Nov 1 2026: 1:30am happens twice, both are Saturday's night.
  assert.equal(businessDate(ny, new Date("2026-11-01T05:30:00Z")), "2026-10-31");
  assert.equal(businessDate(ny, new Date("2026-11-01T06:30:00Z")), "2026-10-31");
});

test("a Sunday close past midnight stays in Sunday's pay week", () => {
  // Mon Nov 2 2026, 1:15am: Sunday Nov 1's shift, so it's paid with the week of Oct 26.
  const d = businessDate("America/New_York", new Date("2026-11-02T06:15:00Z"));
  assert.equal(d, "2026-11-01");
  assert.equal(mondayOf(d), "2026-10-26");
  assert.equal(payPeriod(d).payday, "2026-11-13");
});

test("before 4am, last night isn't flagged missing yet", () => {
  // 2am Tue Nov 3: Monday's cash-out may still be in progress.
  const today = businessDate("America/New_York", new Date("2026-11-03T07:00:00Z"));
  const period = { from: "2026-11-02", to: "2026-11-08" };
  assert.deepEqual(missingNights(period, [], today, closedWeekdays("")), []);
});
