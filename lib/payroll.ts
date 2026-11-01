// Pay schedule for The Ace: tips are earned over a Monday–Sunday week and paid on the Friday
// two weeks after that week starts (the week of Mon Oct 26 is paid on Fri Nov 13).
// Dates are "YYYY-MM-DD" strings in the restaurant's local calendar; maths is done in UTC so
// daylight-saving changes never shift a day.

const DAY = 86_400_000;
/** Days from a pay week's Monday to the Friday it's paid on. */
export const PAYDAY_OFFSET_DAYS = 18;

const parse = (d: string) => new Date(`${d}T00:00:00Z`);
const format = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (d: string, n: number) => format(new Date(parse(d).getTime() + n * DAY));

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (d: string) => (parse(d).getUTCDay() + 6) % 7;

export const isIsoDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && format(parse(v)) === v;

/** Today's date where the restaurant is. */
export const localToday = (timeZone: string, now = new Date()) => now.toLocaleDateString("en-CA", { timeZone });

export const mondayOf = (d: string) => addDays(d, -weekdayIndex(d));

export type PayPeriod = { weekStart: string; weekEnd: string; payday: string };

export function payPeriod(weekStart: string): PayPeriod {
  const monday = mondayOf(weekStart);
  return { weekStart: monday, weekEnd: addDays(monday, 6), payday: addDays(monday, PAYDAY_OFFSET_DAYS) };
}

/** The next Friday on or after `today`. */
export const upcomingPayday = (today: string) => addDays(today, (4 - weekdayIndex(today) + 7) % 7);

/** The pay week that is paid on a given Friday. */
export const periodForPayday = (payday: string) => payPeriod(addDays(payday, -PAYDAY_OFFSET_DAYS));

/** The week being paid this coming Friday (or today, on a Friday). */
export const currentPayPeriod = (today: string) => periodForPayday(upcomingPayday(today));

/** Every date from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Days the restaurant is closed, from CLOSED_DAYS (e.g. "mon" or "mon,tue"); those never count as missing. */
export function closedWeekdays(raw = process.env.CLOSED_DAYS ?? "") {
  return new Set(
    raw
      .toLowerCase()
      .split(/[\s,]+/)
      .map((s) => WEEKDAYS.indexOf(s.slice(0, 3)))
      .filter((i) => i >= 0),
  );
}

/** Open days in the period, up to yesterday, that have no saved cash-out. */
export function missingNights(period: { from: string; to: string }, savedDates: Iterable<string>, today: string, closed = closedWeekdays()) {
  const saved = new Set(savedDates);
  const last = period.to < today ? period.to : addDays(today, -1);
  return datesBetween(period.from, last).filter((d) => !saved.has(d) && !closed.has(weekdayIndex(d)));
}

export function formatDay(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function formatRange(from: string, to: string) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDay(from, { weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })} – ${formatDay(to, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}
