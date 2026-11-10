import { test } from "node:test";
import assert from "node:assert/strict";
import { shiftsToCsv } from "./csv.ts";
import type { SavedShift } from "./history";

const shift = (shiftDate: string, staff: [string, number, number][], service: SavedShift["service"] = null): SavedShift => {
  const fohCents = staff.reduce((a, [, , c]) => a + c, 0);
  const bohCents = Math.round((fohCents * 3) / 7);
  return {
    id: `${shiftDate}-${service}`,
    createdAt: new Date(`${shiftDate}T23:30:00Z`),
    updatedAt: new Date(`${shiftDate}T23:30:00Z`),
    shiftDate,
    service,
    timeZone: "UTC",
    cashCents: fohCents + bohCents,
    cardCents: 0,
    totalCents: fohCents + bohCents,
    bohCents,
    fohCents,
    bohShare: 0.3,
    totalHours: staff.reduce((a, [, h]) => a + h, 0),
    staff: staff.map(([name, hours, amountCents]) => ({ name, hours, amountCents })),
  };
};

// Newest first, like loadHistory returns them. Two pay weeks: Oct 26–Nov 1 and Nov 2–8.
const shifts = [
  shift("2026-11-03", [["Ana", 6, 12000], ["Ben", 4, 8000]]),
  shift("2026-11-01", [["ana ", 5, 10000]], "night"),
  shift("2026-11-01", [["Ben", 3, 4500]], "brunch"),
  shift("2026-10-27", [["Ana", 6, 9000], ["Cy", 6, 9000]]),
];

const sections = (csv: string) =>
  Object.fromEntries(
    csv
      .trim()
      .split("\r\n\r\n")
      .map((block) => {
        const [title, header, ...rows] = block.split("\r\n");
        return [title, { header, rows }];
      }),
  );

test("the CSV totals each person for the whole range, matching names loosely", () => {
  const s = sections(shiftsToCsv(shifts))["TOTALS BY PERSON"];
  assert.equal(s.header, "Name,Shifts,Hours,Tips");
  assert.deepEqual(s.rows, ["Ana,3,17,310.00", "Ben,2,7,125.00", "Cy,1,6,90.00", "All FOH,,30,525.00"]);
});

test("the CSV totals each person for each Mon–Sun pay week, with its payday", () => {
  const s = sections(shiftsToCsv(shifts))["WEEKLY TOTALS BY PERSON"];
  assert.deepEqual(s.rows, [
    "2026-10-26,2026-11-01,2026-11-13,Ana,2,11,190.00,",
    "2026-10-26,2026-11-01,2026-11-13,Ben,1,3,45.00,",
    "2026-10-26,2026-11-01,2026-11-13,Cy,1,6,90.00,",
    "2026-11-02,2026-11-08,2026-11-20,Ana,1,6,120.00,",
    "2026-11-02,2026-11-08,2026-11-20,Ben,1,4,80.00,",
  ]);
  const weeks = sections(shiftsToCsv(shifts))["WEEKLY TOTALS"].rows;
  assert.equal(weeks.length, 3);
  assert.match(weeks[0], /^2026-10-26,2026-11-01,2026-11-13,3,/);
  assert.match(weeks[2], /^All weeks,,,4,/);
});

test("weeks cut short by the chosen range say which days they cover", () => {
  const s = sections(shiftsToCsv(shifts, { from: "2026-10-27", to: "2026-11-04" }));
  assert.match(s["WEEKLY TOTALS BY PERSON"].rows[0], /,"Part week: only Tue, Oct 27 – Sun, Nov 1, 2026"$/);
  assert.match(s["WEEKLY TOTALS"].rows[1], /,"Part week: only Mon, Nov 2 – Wed, Nov 4, 2026"$/);
  // A whole pay week, like the payday export, has no note.
  assert.match(sections(shiftsToCsv(shifts, { from: "2026-10-26", to: "2026-11-08" }))["WEEKLY TOTALS"].rows[0], /,$/);
});

test("the CSV still lists every person on every shift, oldest first", () => {
  const s = sections(shiftsToCsv(shifts))["EVERY SHIFT"];
  assert.equal(s.rows.length, 6);
  assert.match(s.rows[0], /^2026-10-26,2026-10-27,Tue,,"Oct 27, 11:30 PM",Ana,6,90.00,/);
  assert.match(s.rows[3], /^2026-10-26,2026-11-01,Sun,Night,.*,ana ,5,100.00,/);
});

test("an empty range still gives a readable file", () => {
  const s = sections(shiftsToCsv([]));
  assert.deepEqual(s["TOTALS BY PERSON"].rows, ["All FOH,,0,0.00"]);
  assert.deepEqual(s["EVERY SHIFT"].rows, []);
});
