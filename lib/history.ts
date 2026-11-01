import "server-only";
import { BOH_SHARE, type CashOut } from "./cashout";
import { transaction, withDb } from "./db";
import { addDays, currentPayPeriod, isIsoDate, localToday, missingNights, mondayOf, payPeriod, type PayPeriod } from "./payroll";

export type SavedShift = {
  id: string;
  createdAt: Date;
  shiftDate: string; // YYYY-MM-DD
  timeZone: string;
  cashCents: number;
  cardCents: number;
  totalCents: number;
  bohCents: number;
  fohCents: number;
  bohShare: number;
  totalHours: number;
  staff: { name: string; hours: number; amountCents: number }[];
};

export type StaffTotal = { name: string; shifts: number; hours: number; amountCents: number };

export const RANGES = {
  payday: "Payday",
  week: "This week",
  "last-week": "Last week",
  month: "This month",
  all: "All time",
} as const;
export type RangeKey = keyof typeof RANGES;

export const isRangeKey = (v: unknown): v is RangeKey => typeof v === "string" && v in RANGES;

/** Thrown when a change would touch a week that has already been paid out. */
export class PaidWeekError extends Error {
  constructor() {
    super("That week has already been paid, so its cash-outs are locked.");
  }
}

type Db = Parameters<Parameters<typeof transaction>[0]>[0];

/** Locks the pay-period rows involved and fails if any of those weeks is paid. */
async function assertUnpaid(db: Db, dates: string[]) {
  const weeks = [...new Set(dates.map(mondayOf))];
  const { rowCount } = await db.query("select 1 from pay_periods where week_start = any($1::date[]) for share", [weeks]);
  if (rowCount) throw new PaidWeekError();
}

/** Saves a cash-out, or replaces it when the same shift is saved again after a correction. */
export async function saveShift(id: string, r: CashOut, shiftDate: string, timeZone: string) {
  const cents = (d: number) => Math.round(d * 100);
  await transaction(async (db) => {
    const existing = await db.query<{ d: string }>("select to_char(shift_date, 'YYYY-MM-DD') as d from cashouts where id = $1 for update", [id]);
    await assertUnpaid(db, [shiftDate, ...existing.rows.map((row) => row.d)]);
    await db.query(
      `insert into cashouts (id, shift_date, time_zone, cash_cents, card_cents, total_cents, boh_cents, foh_cents, boh_share, total_hours)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (id) do update set
         updated_at = now(), shift_date = excluded.shift_date, time_zone = excluded.time_zone,
         cash_cents = excluded.cash_cents, card_cents = excluded.card_cents, total_cents = excluded.total_cents,
         boh_cents = excluded.boh_cents, foh_cents = excluded.foh_cents, boh_share = excluded.boh_share,
         total_hours = excluded.total_hours`,
      [id, shiftDate, timeZone, cents(r.cash), cents(r.card), cents(r.totalTips), cents(r.bohTips), cents(r.fohTips), BOH_SHARE, r.totalHours],
    );
    await db.query("delete from cashout_staff where cashout_id = $1", [id]);
    await db.query(
      `insert into cashout_staff (cashout_id, position, name, hours, amount_cents)
       select $1, p.position, p.name, p.hours, p.amount_cents
       from unnest($2::smallint[], $3::text[], $4::numeric[], $5::integer[]) as p(position, name, hours, amount_cents)`,
      [
        id,
        r.staffTips.map((_, i) => i),
        r.staffTips.map((s) => s.name),
        r.staffTips.map((s) => s.hours),
        r.staffTips.map((s) => cents(s.amount)),
      ],
    );
  });
}

export async function deleteShift(id: string) {
  await transaction(async (db) => {
    const { rows } = await db.query<{ d: string }>("select to_char(shift_date, 'YYYY-MM-DD') as d from cashouts where id = $1 for update", [id]);
    if (!rows.length) return;
    await assertUnpaid(db, [rows[0].d]);
    await db.query("delete from cashouts where id = $1", [id]);
  });
}

/** Locks a pay week, recording what it added up to when it was paid. */
export async function markWeekPaid(weekStart: string) {
  const { weekStart: monday, weekEnd } = payPeriod(weekStart);
  await withDb((db) =>
    db.query(
      `insert into pay_periods (week_start, total_cents)
       select $1::date, coalesce(sum(total_cents), 0) from cashouts where shift_date between $1::date and $2::date
       on conflict (week_start) do nothing`,
      [monday, weekEnd],
    ),
  );
}

export async function unmarkWeekPaid(weekStart: string) {
  await withDb((db) => db.query("delete from pay_periods where week_start = $1", [mondayOf(weekStart)]));
}

/** The zone of the most recent save stands in for the restaurant's local time. */
export async function restaurantTimeZone() {
  const { rows } = await withDb((db) => db.query<{ time_zone: string }>("select time_zone from cashouts order by created_at desc limit 1"));
  return rows[0]?.time_zone ?? process.env.APP_TIME_ZONE ?? "UTC";
}

/** Inclusive date bounds for a range, in the restaurant's local calendar. Weeks start on Monday. */
export function rangeBounds(range: RangeKey, timeZone: string, now = new Date()): { from: string | null; to: string | null } {
  const today = localToday(timeZone, now);
  const monday = mondayOf(today);
  switch (range) {
    case "payday": {
      const p = currentPayPeriod(today);
      return { from: p.weekStart, to: p.weekEnd };
    }
    case "week":
      return { from: monday, to: addDays(monday, 6) };
    case "last-week":
      return { from: addDays(monday, -7), to: addDays(monday, -1) };
    case "month": {
      const first = `${today.slice(0, 8)}01`;
      return { from: first, to: addDays(`${addDays(first, 31).slice(0, 8)}01`, -1) };
    }
    case "all":
      return { from: null, to: null };
  }
}

export type PeriodStatus = PayPeriod & {
  paid: { paidAt: Date; totalCents: number } | null;
  missing: string[];
  isCurrent: boolean;
};

/**
 * Loads saved shifts for a range. The "payday" range is one pay week: the one paid this
 * coming Friday, or the week starting on `week` when given.
 */
export async function loadHistory(range: RangeKey, week?: string) {
  const timeZone = await restaurantTimeZone();
  const today = localToday(timeZone);
  let period: PayPeriod | null = null;
  let from: string | null;
  let to: string | null;
  if (range === "payday") {
    const current = currentPayPeriod(today);
    period = isIsoDate(week) ? payPeriod(week) : current;
    ({ weekStart: from, weekEnd: to } = period);
  } else {
    ({ from, to } = rangeBounds(range, timeZone));
  }

  const { rows } = await withDb((db) =>
    db.query(
      `select c.id, c.created_at, to_char(c.shift_date, 'YYYY-MM-DD') as shift_date, c.time_zone,
              c.cash_cents, c.card_cents, c.total_cents, c.boh_cents, c.foh_cents,
              c.boh_share::float8 as boh_share, c.total_hours::float8 as total_hours,
              coalesce(json_agg(json_build_object('name', s.name, 'hours', s.hours::float8, 'amountCents', s.amount_cents)
                         order by s.position) filter (where s.cashout_id is not null), '[]') as staff
       from cashouts c
       left join cashout_staff s on s.cashout_id = c.id
       where ($1::date is null or c.shift_date >= $1) and ($2::date is null or c.shift_date <= $2)
       group by c.id
       order by c.shift_date desc, c.created_at desc
       limit 1000`,
      [from, to],
    ),
  );

  const shifts: SavedShift[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    shiftDate: r.shift_date,
    timeZone: r.time_zone,
    cashCents: r.cash_cents,
    cardCents: r.card_cents,
    totalCents: r.total_cents,
    bohCents: r.boh_cents,
    fohCents: r.foh_cents,
    bohShare: r.boh_share,
    totalHours: r.total_hours,
    staff: r.staff,
  }));

  // People are matched by name, ignoring case and stray spaces.
  const byName = new Map<string, StaffTotal>();
  for (const shift of shifts) {
    for (const s of shift.staff) {
      const key = s.name.trim().toLowerCase();
      const t = byName.get(key) ?? { name: s.name.trim(), shifts: 0, hours: 0, amountCents: 0 };
      t.shifts += 1;
      t.hours += s.hours;
      t.amountCents += s.amountCents;
      byName.set(key, t);
    }
  }
  const staffTotals = [...byName.values()].sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name));

  const sum = (f: (s: SavedShift) => number) => shifts.reduce((a, s) => a + f(s), 0);
  const totals = {
    shifts: shifts.length,
    totalCents: sum((s) => s.totalCents),
    bohCents: sum((s) => s.bohCents),
    fohCents: sum((s) => s.fohCents),
    hours: sum((s) => s.totalHours),
  };

  // Weeks already paid out, so the UI can show their shifts as locked.
  const weeks = [...new Set(shifts.map((s) => mondayOf(s.shiftDate)))];
  const { rows: paidWeekRows } = await withDb((db) =>
    db.query<{ w: string }>("select to_char(week_start, 'YYYY-MM-DD') as w from pay_periods where week_start = any($1::date[])", [weeks]),
  );
  const paidWeeks = paidWeekRows.map((r) => r.w);

  let periodStatus: PeriodStatus | null = null;
  if (period) {
    const { rows: paidRows } = await withDb((db) =>
      db.query<{ paid_at: Date; total_cents: number }>("select paid_at, total_cents from pay_periods where week_start = $1", [period.weekStart]),
    );
    periodStatus = {
      ...period,
      paid: paidRows[0] ? { paidAt: paidRows[0].paid_at, totalCents: paidRows[0].total_cents } : null,
      missing: missingNights({ from: period.weekStart, to: period.weekEnd }, shifts.map((s) => s.shiftDate), today),
      isCurrent: period.weekStart === currentPayPeriod(today).weekStart,
    };
  }

  return { range, from, to, timeZone, today, period: periodStatus, shifts, staffTotals, totals, paidWeeks };
}
