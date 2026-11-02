import { test } from "node:test";
import assert from "node:assert/strict";
import { cashOutQuip } from "./quips.ts";

const seeds = Array.from({ length: 600 }, (_, i) => `shift-${i}`);
const lines = (o: Omit<Parameters<typeof cashOutQuip>[0], "seed">) => seeds.map((seed) => cashOutQuip({ ...o, seed }));

test("same cash-out always gets the same line", () => {
  const o = { totalTips: 500, fohRate: 20, names: ["Daniel"], weekday: 1, seed: "abc" };
  assert.equal(cashOutQuip(o), cashOutQuip(o));
});

test("tiers follow the hourly rate", () => {
  for (const l of lines({ totalTips: 50, fohRate: 2 })) assert.match(l, /Slow|Quiet|Character|Big Dog/);
  for (const l of lines({ totalTips: 5000, fohRate: 80 })) assert.match(l, /Legendary|Big|Monster/);
});

test("name jokes only show when those people are on the tip-out", () => {
  assert.ok(!lines({ totalTips: 500, fohRate: 20, names: ["Asa"] }).some((l) => /Daniel|Nat/.test(l)));
  assert.ok(!lines({ totalTips: 500, fohRate: 20, names: ["Nat"] }).some((l) => /Nat only/.test(l)));
  const both = lines({ totalTips: 500, fohRate: 20, names: ["Nat", " archie "] });
  assert.ok(both.some((l) => /Nat only roasted Archie/.test(l)));
  const daniel = lines({ totalTips: 500, fohRate: 20, names: ["Daniel"] });
  const share = daniel.filter((l) => /Daniel/.test(l)).length / daniel.length;
  assert.ok(share > 0.05 && share < 0.4, `Daniel joke should be occasional, got ${share}`);
});

test("Big Dog shows up more on Mondays", () => {
  const count = (weekday: number) => lines({ totalTips: 500, fohRate: 20, weekday }).filter((l) => /Big Dog/.test(l)).length;
  assert.ok(count(1) > count(4));
  assert.ok(count(4) > 0, "still drops by now and then");
});

test("exact-total easter eggs win", () => {
  assert.equal(cashOutQuip({ totalTips: 21, fohRate: 5 }), "Blackjack. The Ace approves.");
  assert.equal(cashOutQuip({ totalTips: 100, fohRate: 5 }), "A clean hundred. Suspiciously round.");
  assert.equal(cashOutQuip({ totalTips: 777, fohRate: 40 }), "Lucky sevens. Drinks are still not on the house.");
});

test("no tips, no commentary", () => {
  assert.equal(cashOutQuip({ totalTips: 0, fohRate: 0 }), "");
});
