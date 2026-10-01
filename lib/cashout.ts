export const BOH_SHARE = 0.3;
export const FOH_SHARE = 1 - BOH_SHARE;

export type StaffPayout = { name: string; hours: number; amount: number };

export type CashOut = {
  dateTime: string;
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

export function calculateCashOut(
  cash: number,
  card: number,
  staff: { name: string; hours: number }[],
  date = new Date(),
): CashOut {
  const totalTips = cash + card;
  const bohTips = totalTips * BOH_SHARE;
  const fohTips = totalTips * FOH_SHARE;
  const totalHours = staff.reduce((sum, s) => sum + s.hours, 0);
  const fohRate = totalHours > 0 ? fohTips / totalHours : 0;

  return {
    dateTime: formatDateTime(date),
    cash,
    card,
    totalTips,
    bohTips,
    fohTips,
    totalHours,
    fohRate,
    staffTips: staff.map((s) => ({ ...s, amount: s.hours * fohRate })),
  };
}

export function cashOutToText(r: CashOut) {
  const lines = [
    `The Ace · Cash-Out`,
    r.dateTime,
    ``,
    `Total tips: ${formatMoney(r.totalTips)}`,
    `  Cash ${formatMoney(r.cash)} · Card ${formatMoney(r.card)}`,
    `BOH (kitchen, ${Math.round(BOH_SHARE * 100)}%): ${formatMoney(r.bohTips)}`,
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
