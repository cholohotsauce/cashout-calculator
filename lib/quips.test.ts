import { test } from "node:test";
import assert from "node:assert/strict";
import { cashOutQuip } from "./quips.ts";

test("same cash-out always gets the same line", () => {
  assert.equal(cashOutQuip(500, 20, "abc"), cashOutQuip(500, 20, "abc"));
});

test("tiers follow the hourly rate", () => {
  assert.match(cashOutQuip(50, 2, "x"), /Slow|Quiet|Character/);
  assert.match(cashOutQuip(5000, 80, "x"), /Legendary/);
});

test("exact-total easter eggs win over the tier", () => {
  assert.equal(cashOutQuip(21, 5, "x"), "Blackjack. The Ace approves.");
  assert.equal(cashOutQuip(777, 40, "y"), "Lucky sevens. Drinks are still not on the house.");
});

test("no tips, no commentary", () => {
  assert.equal(cashOutQuip(0, 0), "");
});
