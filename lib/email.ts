import "server-only";
import { formatMoney } from "./cashout";
import { csvFileName, shiftsToCsv } from "./csv";
import type { loadHistory } from "./history";
import { formatDay, formatRange } from "./payroll";

type History = Awaited<ReturnType<typeof loadHistory>>;

export const appUrl = () => (process.env.APP_URL ?? "https://acecashout.com").replace(/\/$/, "");
export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.PAYROLL_EMAIL);
/** Pay stubs only need the sending key; they go to the addresses on the roster. */
export const canSendEmail = () => Boolean(process.env.RESEND_API_KEY);

const money = (c: number) => formatMoney(c / 100);
const hours = (h: number) => `${+h.toFixed(2)}`;
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const C = {
  ink: "#1c1917",
  muted: "#78716c",
  faint: "#a8a29e",
  line: "#e7e5e4",
  bg: "#f5f5f4",
  card: "#ffffff",
  copper: "#a6683e",
  copperBg: "#fbf3ec",
  warnBg: "#fffbeb",
  warnLine: "#fcd34d",
  warnInk: "#92400e",
};
export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** The Thursday email Rafa gets: who to pay on Friday, for which week, and anything to double-check. */
export function buildPaydayEmail(h: History) {
  if (!h.period) throw new Error("buildPaydayEmail needs a pay period");
  const { period, staffTotals, totals, shifts } = h;
  const paydayLong = formatDay(period.payday, { weekday: "long", month: "long", day: "numeric" });
  const range = formatRange(period.weekStart, period.weekEnd);
  const people = staffTotals.length;
  const cashCents = shifts.reduce((a, s) => a + s.cashCents, 0);
  const cardCents = shifts.reduce((a, s) => a + s.cardCents, 0);
  const link = `${appUrl()}/history?range=payday&week=${period.weekStart}`;

  const subject =
    shifts.length === 0
      ? `Tip payday ${formatDay(period.payday)}: no cash-outs saved for ${range}`
      : `Tip payday ${formatDay(period.payday)}: ${money(totals.fohCents)} to ${people} ${people === 1 ? "person" : "people"}`;
  const preheader = shifts.length
    ? `Tips for ${range}. FOH ${money(totals.fohCents)}, kitchen ${money(totals.bohCents)}.`
    : `Nothing was saved for ${range}.`;

  const rows = staffTotals
    .map(
      (s, i) => `
      <tr>
        <td style="padding:12px 0;border-top:${i ? `1px solid ${C.line}` : "0"};font-size:15px;font-weight:600;color:${C.ink}">${esc(s.name)}</td>
        <td align="right" style="padding:12px 0;border-top:${i ? `1px solid ${C.line}` : "0"};font-size:14px;color:${C.muted}">${s.shifts}</td>
        <td align="right" style="padding:12px 0;border-top:${i ? `1px solid ${C.line}` : "0"};font-size:14px;color:${C.muted}">${hours(s.hours)}</td>
        <td align="right" style="padding:12px 0;border-top:${i ? `1px solid ${C.line}` : "0"};font-size:15px;font-weight:700;color:${C.ink};white-space:nowrap">${money(s.amountCents)}</td>
      </tr>`,
    )
    .join("");

  const warning = period.missing.length
    ? `
      <tr><td style="padding:0 28px 8px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.warnBg};border:1px solid ${C.warnLine};border-radius:12px">
          <tr><td style="padding:14px 16px;font-size:14px;line-height:1.5;color:${C.warnInk}">
            <strong>Check before paying:</strong> no cash-out was saved for
            ${period.missing.map((d) => `<strong>${formatDay(d)}</strong>`).join(", ")}.
            If the restaurant was open, that night's tips aren't in these totals yet.
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const paidNote = period.paid
    ? `<tr><td style="padding:0 28px 8px;font-size:14px;color:${C.muted}">This week was already marked as paid in the app.</td></tr>`
    : "";

  const body = shifts.length
    ? `
      <tr><td style="padding:8px 28px 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.copperBg};border-radius:14px">
          <tr><td align="center" style="padding:22px 16px">
            <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.copper};font-weight:600">Floor staff to pay</div>
            <div style="font-size:38px;line-height:1.2;font-weight:700;color:${C.ink};margin-top:6px">${money(totals.fohCents)}</div>
            <div style="font-size:14px;color:${C.muted};margin-top:4px">${people} ${people === 1 ? "person" : "people"} · ${hours(totals.hours)} hours · ${totals.shifts} ${totals.shifts === 1 ? "shift" : "shifts"}</div>
          </td></tr>
        </table>
      </td></tr>
      ${warning}
      ${paidNote}
      <tr><td style="padding:12px 28px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <th align="left" style="padding-bottom:8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.faint};font-weight:600">Name</th>
            <th align="right" style="padding-bottom:8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.faint};font-weight:600">Shifts</th>
            <th align="right" style="padding-bottom:8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.faint};font-weight:600">Hours</th>
            <th align="right" style="padding-bottom:8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.faint};font-weight:600">Pay</th>
          </tr>
          ${rows}
          <tr>
            <td colspan="3" style="padding:14px 0 0;border-top:2px solid ${C.ink};font-size:15px;font-weight:700;color:${C.ink}">Total floor (FOH)</td>
            <td align="right" style="padding:14px 0 0;border-top:2px solid ${C.ink};font-size:15px;font-weight:700;color:${C.ink};white-space:nowrap">${money(totals.fohCents)}</td>
          </tr>
          <tr>
            <td colspan="3" style="padding:6px 0 0;font-size:15px;color:${C.ink}">Kitchen (BOH)</td>
            <td align="right" style="padding:6px 0 0;font-size:15px;font-weight:600;color:${C.ink};white-space:nowrap">${money(totals.bohCents)}</td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 28px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:12px">
          <tr>
            <td align="center" style="padding:12px 4px;font-size:12px;color:${C.muted}">Tips collected<br><strong style="font-size:15px;color:${C.ink}">${money(totals.totalCents)}</strong></td>
            <td align="center" style="padding:12px 4px;font-size:12px;color:${C.muted};border-left:1px solid ${C.line}">Cash<br><strong style="font-size:15px;color:${C.ink}">${money(cashCents)}</strong></td>
            <td align="center" style="padding:12px 4px;font-size:12px;color:${C.muted};border-left:1px solid ${C.line}">Card<br><strong style="font-size:15px;color:${C.ink}">${money(cardCents)}</strong></td>
          </tr>
        </table>
      </td></tr>`
    : `
      <tr><td style="padding:8px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.warnBg};border:1px solid ${C.warnLine};border-radius:12px">
          <tr><td style="padding:16px;font-size:15px;line-height:1.5;color:${C.warnInk}">
            <strong>No cash-outs were saved for this week.</strong> If the restaurant was open, the shifts need to be saved on the calculator before this week can be paid.
          </td></tr>
        </table>
      </td></tr>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border-radius:20px;overflow:hidden">
        <tr><td style="background:${C.ink};padding:22px 28px">
          <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#e8b48f;font-weight:700">The Ace</div>
          <div style="font-size:13px;color:#d6d3d1;margin-top:2px">Tip payday</div>
        </td></tr>
        <tr><td style="padding:26px 28px 12px">
          <div style="font-size:24px;font-weight:700;color:${C.ink}">Pay day is ${paydayLong}</div>
          <div style="font-size:15px;color:${C.muted};margin-top:4px">Tips earned ${range}</div>
        </td></tr>
        ${body}
        <tr><td align="center" style="padding:26px 28px 8px">
          <a href="${link}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 26px;border-radius:12px">Open this week in the app</a>
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 26px;font-size:13px;line-height:1.5;color:${C.faint}">
          ${shifts.length ? "The full shift-by-shift breakdown is attached as a spreadsheet (CSV).<br>" : ""}
          In the app, mark the week as paid once the money is out. That locks its numbers.
        </td></tr>
      </table>
      <div style="font-size:12px;color:${C.faint};padding:16px">Sent automatically every Thursday by the Ace Cash-Out calculator.</div>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Pay day is ${paydayLong}`,
    `Tips earned ${range}`,
    "",
    ...(shifts.length
      ? [
          `Floor staff to pay: ${money(totals.fohCents)} (${people} people, ${hours(totals.hours)} hours)`,
          ...(period.missing.length ? [``, `CHECK: no cash-out saved for ${period.missing.map((d) => formatDay(d)).join(", ")}.`] : []),
          "",
          ...staffTotals.map((s) => `${s.name}: ${money(s.amountCents)} (${hours(s.hours)} h, ${s.shifts} shifts)`),
          "",
          `Total floor (FOH): ${money(totals.fohCents)}`,
          `Kitchen (BOH): ${money(totals.bohCents)}`,
          `Tips collected: ${money(totals.totalCents)} (cash ${money(cashCents)}, card ${money(cardCents)})`,
        ]
      : ["No cash-outs were saved for this week."]),
    "",
    `Open in the app: ${link}`,
  ].join("\n");

  const attachments = shifts.length ? [{ filename: csvFileName(period.weekStart, period.weekEnd), content: shiftsToCsv(shifts) }] : [];
  return { subject, html, text, attachments };
}

/** Sends through Resend (https://resend.com). The sender's domain must be verified there. */
export async function sendEmail(msg: { to: string[]; subject: string; html: string; text: string; attachments: { filename: string; content: string }[] }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "The Ace Cash-Out <payday@acecashout.com>",
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })),
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
}

/** PAYROLL_EMAIL may hold several addresses, separated by commas. */
export const payrollRecipients = () =>
  (process.env.PAYROLL_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
