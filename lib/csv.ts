import type { SavedShift } from "./history";

/** Quotes a CSV field, and defuses values a spreadsheet would run as a formula. */
function field(value: string | number) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const dollars = (c: number) => (c / 100).toFixed(2);

/** One row per person per shift, oldest first: what payroll needs. */
export function shiftsToCsv(shifts: SavedShift[]) {
  const rows: (string | number)[][] = [
    ["Shift date", "Saved at", "Name", "Hours", "Payout", "Shift total tips", "Cash", "Card", "BOH", "FOH pool"],
  ];
  for (const s of [...shifts].reverse()) {
    const savedAt = s.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: s.timeZone });
    for (const p of s.staff) {
      rows.push([s.shiftDate, savedAt, p.name, p.hours, dollars(p.amountCents), dollars(s.totalCents), dollars(s.cashCents), dollars(s.cardCents), dollars(s.bohCents), dollars(s.fohCents)]);
    }
  }
  return rows.map((r) => r.map(field).join(",")).join("\r\n") + "\r\n";
}

export const csvFileName = (from: string | null, to: string | null) =>
  from && to ? `ace-cashouts-${from}-to-${to}.csv` : "ace-cashouts-all.csv";
