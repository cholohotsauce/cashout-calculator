import "server-only";
import { withDb } from "./db";
import { restaurantTimeZone } from "./history";
import { addDays, localToday, mondayOf } from "./payroll";

export type WeekPoint = {
  weekStart: string;
  totalCents: number;
  fohCents: number;
  hours: number;
  nights: number;
};
export type WeekdayPoint = {
  weekday: number;
  avgCents: number;
  nights: number;
};

/** Weekly totals, tips by weekday, and cash/card mix for the last `weeks` full-or-current weeks. */
export async function loadTrends(weeks = 12) {
  const timeZone = await restaurantTimeZone();
  const today = localToday(timeZone);
  const from = addDays(mondayOf(today), -7 * (weeks - 1));

  // One connection runs one query at a time, so these go in sequence.
  const [weekly, byWeekday, mix, best] = await withDb(async (db) => [
    await db.query(
      `select to_char(date_trunc('week', shift_date)::date, 'YYYY-MM-DD') as week_start,
                sum(total_cents)::int as total_cents, sum(foh_cents)::int as foh_cents,
                sum(total_hours)::float8 as hours, count(distinct shift_date)::int as nights
         from cashouts where shift_date >= $1 group by 1 order by 1`,
      [from],
    ),
    await db.query(
      `select extract(isodow from d)::int - 1 as weekday, avg(total)::float8 as avg_cents, count(*)::int as nights
         from (select shift_date as d, sum(total_cents) as total from cashouts where shift_date >= $1 group by shift_date) n
         group by 1 order by 1`,
      [from],
    ),
    await db.query(
      `select coalesce(sum(cash_cents), 0)::int as cash, coalesce(sum(card_cents), 0)::int as card from cashouts where shift_date >= $1`,
      [from],
    ),
    await db.query(
      `select to_char(shift_date, 'YYYY-MM-DD') as d, sum(total_cents)::int as total
         from cashouts group by shift_date order by total desc limit 1`,
    ),
  ]);

  // Fill in empty weeks so the chart keeps an honest time axis.
  const byStart = new Map(weekly.rows.map((r) => [r.week_start as string, r]));
  const weekPoints: WeekPoint[] = Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(from, i * 7);
    const r = byStart.get(weekStart);
    return {
      weekStart,
      totalCents: r?.total_cents ?? 0,
      fohCents: r?.foh_cents ?? 0,
      hours: r?.hours ?? 0,
      nights: r?.nights ?? 0,
    };
  });

  const weekdayPoints: WeekdayPoint[] = Array.from(
    { length: 7 },
    (_, weekday) => {
      const r = byWeekday.rows.find((x) => x.weekday === weekday);
      return {
        weekday,
        avgCents: Math.round(r?.avg_cents ?? 0),
        nights: r?.nights ?? 0,
      };
    },
  );

  const nights = weekPoints.reduce((a, w) => a + w.nights, 0);
  const total = weekPoints.reduce((a, w) => a + w.totalCents, 0);
  const foh = weekPoints.reduce((a, w) => a + w.fohCents, 0);
  const hours = weekPoints.reduce((a, w) => a + w.hours, 0);

  return {
    from,
    today,
    weeks: weekPoints,
    weekdays: weekdayPoints,
    cashCents: mix.rows[0].cash as number,
    cardCents: mix.rows[0].card as number,
    avgNightCents: nights ? Math.round(total / nights) : 0,
    fohPerHourCents: hours ? Math.round(foh / hours) : 0,
    best: best.rows[0]
      ? {
          date: best.rows[0].d as string,
          totalCents: best.rows[0].total as number,
        }
      : null,
    nights,
  };
}
