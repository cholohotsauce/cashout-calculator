import { test } from "node:test";
import assert from "node:assert/strict";
import { currentPayPeriod, missingNights, payPeriod, periodForPayday, upcomingPayday, closedWeekdays } from "./payroll.ts";

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
