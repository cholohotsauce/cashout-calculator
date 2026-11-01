/** Default kitchen share; the live value is a setting managers can change. */
export const BOH_SHARE = 0.3;

export type StaffPayout = { name: string; hours: number; amount: number };

export type CashOut = {
  dateTime: string;
  bohShare: number;
  cash: number;
  card: number;
  totalTips: number;
  bohTips: number;
  fohTips: number;
  totalHours: number;
  fohRate: number;
  staffTips: StaffPayout[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatMoney(value: number) {
  return money.format(Number.isFinite(value) ? value : 0);
}

/** Parses a user-typed amount; empty or invalid input counts as 0. */
export function parseAmount(value: string) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Keeps only digits and a single decimal point, so stray characters never reach the math. */
export function sanitizeDecimal(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}

export function formatDateTime(date = new Date()) {
  return date.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const toCents = (dollars: number) => Math.round(dollars * 100);

/**
 * Splits `totalCents` by `weights` so the parts are whole cents that add back up to the
 * total exactly (largest-remainder method; ties go to the earlier entry).
 */
export function allocateCents(totalCents: number, weights: number[]) {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum <= 0 || totalCents <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (totalCents * w) / sum);
  const parts = exact.map(Math.floor);
  let left = totalCents - parts.reduce((a, p) => a + p, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}

/**
 * Every dollar figure is rounded to the cent, and the staff payouts plus BOH always add up to
 * exactly the tips collected, so what's printed is what's in the envelope.
 */
export function calculateCashOut(
  cash: number,
  card: number,
  staff: { name: string; hours: number }[],
  date = new Date(),
  bohShare = BOH_SHARE,
): CashOut {
  const cashCents = toCents(cash);
  const cardCents = toCents(card);
  const totalCents = cashCents + cardCents;
  const totalHours = staff.reduce((sum, s) => sum + s.hours, 0);
  const bohCents = Math.round(totalCents * bohShare);
  const fohCents = totalCents - bohCents;
  const shares = allocateCents(fohCents, staff.map((s) => s.hours));

  return {
    dateTime: formatDateTime(date),
    bohShare,
    cash: cashCents / 100,
    card: cardCents / 100,
    totalTips: totalCents / 100,
    bohTips: bohCents / 100,
    fohTips: fohCents / 100,
    totalHours,
    fohRate: totalHours > 0 ? fohCents / 100 / totalHours : 0,
    staffTips: staff.map((s, i) => ({ ...s, amount: shares[i] / 100 })),
  };
}

export function cashOutToText(r: CashOut) {
  const lines = [
    `The Ace · Cash-Out`,
    r.dateTime,
    ``,
    `Total tips: ${formatMoney(r.totalTips)}`,
    `  Cash ${formatMoney(r.cash)} · Card ${formatMoney(r.card)}`,
    `BOH (kitchen, ${Math.round(r.bohShare * 100)}%): ${formatMoney(r.bohTips)}`,
    `FOH pool: ${formatMoney(r.fohTips)}`,
    `FOH rate: ${formatMoney(r.fohRate)}/hr over ${formatHours(r.totalHours)}`,
    `--------------------------`,
    ...r.staffTips.map((s) => `${s.name} (${formatHours(s.hours)}): ${formatMoney(s.amount)}`),
  ];
  return lines.join("\n");
}

export function formatHours(hours: number) {
  return `${+hours.toFixed(2)} h`;
}

export function pdfFileName(date = new Date()) {
  const month = date.toLocaleString("en-US", { month: "long" });
  const hours12 = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${month} ${date.getDate()} ${date.getFullYear()} ${hours12}-${minutes} ${ampm}.pdf`;
}
