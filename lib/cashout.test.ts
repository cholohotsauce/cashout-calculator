import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateCents, calculateCashOut } from "./cashout.ts";

const cents = (d: number) => Math.round(d * 100);

test("payouts and BOH add up to exactly the tips collected", () => {
  for (let i = 0; i < 2000; i++) {
    const cash = Math.round(Math.random() * 300_000) / 100;
    const card = Math.round(Math.random() * 300_000) / 100;
    const staff = Array.from({ length: 1 + Math.floor(Math.random() * 8) }, (_, j) => ({
      name: `P${j}`,
      hours: Math.round((0.25 + Math.random() * 11) * 100) / 100,
    }));
    const r = calculateCashOut(cash, card, staff);
    const paid = r.staffTips.reduce((a, s) => a + cents(s.amount), 0);
    assert.equal(cents(r.cash) + cents(r.card), cents(r.totalTips));
    assert.equal(paid, cents(r.fohTips));
    assert.equal(cents(r.bohTips) + cents(r.fohTips), cents(r.totalTips));
    for (const s of r.staffTips) assert.ok(Math.abs(s.amount * 100 - cents(s.amount)) < 1e-6, "whole cents");
  }
});

test("BOH gets 30% and FOH is split by hours", () => {
  const r = calculateCashOut(600, 400, [
    { name: "A", hours: 6 },
    { name: "B", hours: 4 },
  ]);
  assert.equal(r.totalTips, 1000);
  assert.equal(r.bohTips, 300);
  assert.equal(r.fohTips, 700);
  assert.equal(r.fohRate, 70);
  assert.deepEqual(r.staffTips.map((s) => s.amount), [420, 280]);
});

test("a leftover cent goes to the largest remainder, not lost", () => {
  // $1.00 three ways: 34 + 33 + 33.
  assert.deepEqual(allocateCents(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocateCents(100, [1, 2]), [33, 67]);
  assert.deepEqual(allocateCents(0, [1, 2]), [0, 0]);
  assert.deepEqual(allocateCents(500, []), []);
});

test("float inputs don't drift", () => {
  const r = calculateCashOut(0.1, 0.2, [{ name: "A", hours: 1 }]);
  assert.equal(r.totalTips, 0.3);
  assert.equal(r.bohTips + r.fohTips, 0.3);
});
