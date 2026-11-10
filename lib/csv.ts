import type { SavedShift } from "./history";
import { SERVICES } from "./cashout.ts";
import { formatDay, formatRange, payPeriod } from "./payroll.ts";

type Cell = string | number;

/** Quotes a CSV field, and defuses values a spreadsheet would run as a formula. */
function field(value: Cell) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const dollars = (c: number) => (c / 100).toFixed(2);
const hours = (h: number) => +h.toFixed(2);

type PersonTotal = { name: string; shifts: number; hours: number; cents: number };

/** Adds up payouts per person. People are matched by name, ignoring case and stray spaces. */
function totalsByPerson(entries: Iterable<{ name: string; hours: number; amountCents: number }>) {
  const byName = new Map<string, PersonTotal>();
  for (const p of entries) {
    const key = p.name.trim().toLowerCase();
    const t = byName.get(key) ?? { name: p.name.trim(), shifts: 0, hours: 0, cents: 0 };
    t.shifts += 1;
    t.hours += p.hours;
    t.cents += p.amountCents;
    byName.set(key, t);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The cash-outs as one spreadsheet, in three parts separated by a blank row:
 *  1. each person's total for the whole range,
 *  2. each person's total for each Mon–Sun pay week, plus each week's tips,
 *  3. every shift in full, one row per person per shift, oldest first.
 * When `range` cuts a pay week short (a quarter rarely starts on a Monday), that week's rows
 * say which days they cover, since they won't match what was paid that Friday.
 */
export function shiftsToCsv(shifts: SavedShift[], range?: { from: string | null; to: string | null }) {
  const oldestFirst = [...shifts].reverse();
  const rows: Cell[][] = [];
  const section = (title: string, header: Cell[]) => {
    if (rows.length) rows.push([]);
    rows.push([title]);
    rows.push(header);
  };

  // 1. Whole range, per person.
  const people = totalsByPerson(oldestFirst.flatMap((s) => s.staff));
  section("TOTALS BY PERSON", ["Name", "Shifts", "Hours", "Tips"]);
  for (const p of people) rows.push([p.name, p.shifts, hours(p.hours), dollars(p.cents)]);
  rows.push(["All FOH", "", hours(people.reduce((a, p) => a + p.hours, 0)), dollars(people.reduce((a, p) => a + p.cents, 0))]);

  // Pay weeks, oldest first.
  const weeks = new Map<string, SavedShift[]>();
  for (const s of oldestFirst) {
    const { weekStart } = payPeriod(s.shiftDate);
    weeks.set(weekStart, [...(weeks.get(weekStart) ?? []), s]);
  }

  const partNote = (weekStart: string, weekEnd: string) => {
    const from = range?.from && range.from > weekStart ? range.from : weekStart;
    const to = range?.to && range.to < weekEnd ? range.to : weekEnd;
    return from === weekStart && to === weekEnd ? "" : `Part week: only ${formatRange(from, to)}`;
  };

  // 2a. Each week, per person.
  section("WEEKLY TOTALS BY PERSON", ["Week start", "Week end", "Payday", "Name", "Shifts", "Hours", "Tips", "Note"]);
  for (const [weekStart, list] of weeks) {
    const { weekEnd, payday } = payPeriod(weekStart);
    const note = partNote(weekStart, weekEnd);
    for (const p of totalsByPerson(list.flatMap((s) => s.staff))) {
      rows.push([weekStart, weekEnd, payday, p.name, p.shifts, hours(p.hours), dollars(p.cents), note]);
    }
  }

  // 2b. Each week, the whole restaurant.
  section("WEEKLY TOTALS", ["Week start", "Week end", "Payday", "Shifts", "Total tips", "Cash", "Card", "BOH", "FOH", "Note"]);
  const sum = (list: SavedShift[], f: (s: SavedShift) => number) => list.reduce((a, s) => a + f(s), 0);
  const money = (list: SavedShift[]) => [
    dollars(sum(list, (s) => s.totalCents)),
    dollars(sum(list, (s) => s.cashCents)),
    dollars(sum(list, (s) => s.cardCents)),
    dollars(sum(list, (s) => s.bohCents)),
    dollars(sum(list, (s) => s.fohCents)),
  ];
  for (const [weekStart, list] of weeks) {
    const { weekEnd, payday } = payPeriod(weekStart);
    rows.push([weekStart, weekEnd, payday, list.length, ...money(list), partNote(weekStart, weekEnd)]);
  }
  rows.push(["All weeks", "", "", shifts.length, ...money(shifts), ""]);

  // 3. Everything.
  section("EVERY SHIFT", ["Week start", "Shift date", "Day", "Service", "Saved at", "Name", "Hours", "Payout", "Shift total tips", "Cash", "Card", "BOH", "FOH pool"]);
  for (const s of oldestFirst) {
    const savedAt = s.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: s.timeZone });
    const day = formatDay(s.shiftDate, { weekday: "short" });
    for (const p of s.staff) {
      rows.push([
        payPeriod(s.shiftDate).weekStart,
        s.shiftDate,
        day,
        s.service ? SERVICES[s.service] : "",
        savedAt,
        p.name,
        p.hours,
        dollars(p.amountCents),
        dollars(s.totalCents),
        dollars(s.cashCents),
        dollars(s.cardCents),
        dollars(s.bohCents),
        dollars(s.fohCents),
      ]);
    }
  }
  return rows.map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}

export const csvFileName = (from: string | null, to: string | null) =>
  from && to ? `ace-cashouts-${from}-to-${to}.csv` : "ace-cashouts-all.csv";
