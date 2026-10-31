import "server-only";
import { BOH_SHARE, type CashOut } from "./cashout";
import { transaction, withDb } from "./db";

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
  week: "This week",
  "last-week": "Last week",
  month: "This month",
  all: "All time",
} as const;
export type RangeKey = keyof typeof RANGES;

export const isRangeKey = (v: unknown): v is RangeKey => typeof v === "string" && v in RANGES;

/** Saves a cash-out, or replaces it when the same shift is saved again after a correction. */
export async function saveShift(id: string, r: CashOut, shiftDate: string, timeZone: string) {
  const cents = (d: number) => Math.round(d * 100);
  await transaction(async (db) => {
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
  await withDb((db) => db.query("delete from cashouts where id = $1", [id]));
}

/** The zone of the most recent save stands in for the restaurant's local time. */
async function restaurantTimeZone() {
  const { rows } = await withDb((db) => db.query<{ time_zone: string }>("select time_zone from cashouts order by created_at desc limit 1"));
  return rows[0]?.time_zone ?? process.env.APP_TIME_ZONE ?? "UTC";
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Inclusive date bounds for a range, in the restaurant's local calendar. Weeks start on Monday. */
export function rangeBounds(range: RangeKey, timeZone: string, now = new Date()) {
  // en-CA formats as YYYY-MM-DD; parsing that as UTC lets us do calendar maths without DST surprises.
  const today = new Date(`${now.toLocaleDateString("en-CA", { timeZone })}T00:00:00Z`);
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
  const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
  switch (range) {
    case "week":
      return { from: isoDate(monday), to: isoDate(addDays(monday, 6)) };
    case "last-week":
      return { from: isoDate(addDays(monday, -7)), to: isoDate(addDays(monday, -1)) };
    case "month": {
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
      return { from: isoDate(first), to: isoDate(last) };
    }
    case "all":
      return { from: null, to: null };
  }
}

export async function loadHistory(range: RangeKey) {
  const timeZone = await restaurantTimeZone();
  const { from, to } = rangeBounds(range, timeZone);
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

  return { range, from, to, timeZone, shifts, staffTotals, totals };
}
