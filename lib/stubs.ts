import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { formatMoney } from "./cashout";
import { withDb } from "./db";
import { audit } from "./audit";
import { C, FONT, appUrl, canSendEmail, esc, sendEmail } from "./email";
import { loadHistory } from "./history";
import { listStaff } from "./staff";
import { formatDay, formatRange, isIsoDate, mondayOf, type PayPeriod } from "./payroll";

// A pay stub is one person's share of one paid week, emailed when the week is marked paid.
// Each stub links to a private page; the link is signed, so it can't be guessed or edited
// to show someone else's pay.

const money = (c: number) => formatMoney(c / 100);
const hrs = (h: number) => `${+h.toFixed(2)}`;
const key = (name: string) => name.trim().toLowerCase();

function stubKey() {
  const secret = process.env.SESSION_SECRET ?? process.env.DATABASE_URL ?? "";
  return createHash("sha256").update(`ace-stub:${secret}`).digest();
}

export function stubToken(weekStart: string, name: string) {
  return createHmac("sha256", stubKey()).update(`${mondayOf(weekStart)}|${key(name)}`).digest("base64url").slice(0, 32);
}

export function verifyStubToken(weekStart: string, name: string, token: string) {
  if (!isIsoDate(weekStart) || !name) return false;
  const a = Buffer.from(stubToken(weekStart, name));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function stubUrl(weekStart: string, name: string) {
  const q = new URLSearchParams({ w: mondayOf(weekStart), n: name.trim(), t: stubToken(weekStart, name) });
  return `${appUrl()}/stub?${q}`;
}

export type Stub = {
  name: string;
  period: PayPeriod;
  paid: boolean;
  nights: { date: string; hours: number; amountCents: number }[];
  hours: number;
  amountCents: number;
};

/** Every person's stub for a pay week, from the saved cash-outs. */
export async function weekStubs(weekStart: string): Promise<Stub[]> {
  const h = await loadHistory("payday", weekStart);
  const period = h.period!;
  const byName = new Map<string, Stub>();
  for (const shift of [...h.shifts].reverse()) {
    for (const s of shift.staff) {
      const stub = byName.get(key(s.name)) ?? { name: s.name.trim(), period, paid: Boolean(period.paid), nights: [], hours: 0, amountCents: 0 };
      stub.nights.push({ date: shift.shiftDate, hours: s.hours, amountCents: s.amountCents });
      stub.hours += s.hours;
      stub.amountCents += s.amountCents;
      byName.set(key(s.name), stub);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function personStub(weekStart: string, name: string) {
  return (await weekStubs(weekStart)).find((s) => key(s.name) === key(name)) ?? null;
}

export function buildStubEmail(stub: Stub) {
  const { period } = stub;
  const first = stub.name.split(" ")[0];
  const range = formatRange(period.weekStart, period.weekEnd);
  const payday = formatDay(period.payday, { weekday: "long", month: "long", day: "numeric" });
  const link = stubUrl(period.weekStart, stub.name);
  const perHour = stub.hours > 0 ? stub.amountCents / stub.hours : 0;
  const subject = `Your tips for ${range}: ${money(stub.amountCents)}`;

  const rows = stub.nights
    .map(
      (n, i) => `
      <tr>
        <td style="padding:11px 0;border-top:${i ? `1px solid ${C.line}` : "0"};font-size:15px;color:${C.ink}">${formatDay(n.date)}</td>
        <td align="right" style="padding:11px 0;border-top:${i ? `1px solid ${C.line}` : "0"};font-size:14px;color:${C.muted}">${hrs(n.hours)} h</td>
        <td align="right" style="padding:11px 0;border-top:${i ? `1px solid ${C.line}` : "0"};font-size:15px;font-weight:600;color:${C.ink};white-space:nowrap">${money(n.amountCents)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(`${money(stub.amountCents)} for ${stub.nights.length} ${stub.nights.length === 1 ? "night" : "nights"}, paid ${payday}.`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border-radius:20px;overflow:hidden">
        <tr><td style="background:${C.ink};padding:22px 28px">
          <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#e8b48f;font-weight:700">The Ace</div>
          <div style="font-size:13px;color:#d6d3d1;margin-top:2px">Tip pay stub</div>
        </td></tr>
        <tr><td style="padding:26px 28px 6px">
          <div style="font-size:22px;font-weight:700;color:${C.ink}">Hi ${esc(first)}, here are your tips</div>
          <div style="font-size:15px;color:${C.muted};margin-top:4px">Week of ${range} · paid ${payday}</div>
        </td></tr>
        <tr><td style="padding:14px 28px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.copperBg};border-radius:14px">
            <tr><td align="center" style="padding:22px 16px">
              <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.copper};font-weight:600">Your tips</div>
              <div style="font-size:38px;line-height:1.2;font-weight:700;color:${C.ink};margin-top:6px">${money(stub.amountCents)}</div>
              <div style="font-size:14px;color:${C.muted};margin-top:4px">${stub.nights.length} ${stub.nights.length === 1 ? "night" : "nights"} · ${hrs(stub.hours)} hours · ${money(perHour)}/hr</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${rows}
            <tr>
              <td colspan="2" style="padding:13px 0 0;border-top:2px solid ${C.ink};font-size:15px;font-weight:700;color:${C.ink}">Total</td>
              <td align="right" style="padding:13px 0 0;border-top:2px solid ${C.ink};font-size:15px;font-weight:700;color:${C.ink};white-space:nowrap">${money(stub.amountCents)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:26px 28px 8px">
          <a href="${link}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 26px;border-radius:12px">View your stub online</a>
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 26px;font-size:13px;line-height:1.5;color:${C.faint}">
          Tips are split by hours worked each night, after the kitchen's share.<br>If something looks off, talk to a manager.
        </td></tr>
      </table>
      <div style="font-size:12px;color:${C.faint};padding:16px">Sent by the Ace Cash-Out calculator when this week was paid.</div>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Hi ${first}, here are your tips`,
    `Week of ${range}, paid ${payday}`,
    "",
    `Your tips: ${money(stub.amountCents)} (${stub.nights.length} nights, ${hrs(stub.hours)} hours, ${money(perHour)}/hr)`,
    "",
    ...stub.nights.map((n) => `${formatDay(n.date)}: ${money(n.amountCents)} (${hrs(n.hours)} h)`),
    "",
    `View online: ${link}`,
  ].join("\n");

  return { subject, html, text, attachments: [] };
}

/**
 * Emails a stub to everyone on the roster with an email who earned tips that week.
 * Each (week, person) is claimed in email_log first, so paying, unlocking and paying again
 * never sends a second copy.
 */
export async function sendPayStubs(weekStart: string) {
  if (!canSendEmail()) return { sent: 0, reason: "RESEND_API_KEY isn't set" };
  const monday = mondayOf(weekStart);
  const [stubs, staff] = await Promise.all([weekStubs(monday), listStaff()]);
  // Stubs describe money paid out, so only a week marked paid sends them.
  if (!stubs.some((s) => s.paid)) return { sent: 0, reason: "week isn't marked paid" };
  const emails = new Map(staff.filter((s) => s.email).map((s) => [key(s.name), s.email!]));
  const sentTo: string[] = [];
  for (const stub of stubs) {
    const to = emails.get(key(stub.name));
    if (!to || stub.amountCents <= 0) continue;
    const claimKey = `${monday}:${key(stub.name)}`;
    const claimed = await withDb((db) => db.query("insert into email_log (kind, key) values ('stub', $1) on conflict do nothing", [claimKey]));
    if (!claimed.rowCount) continue;
    try {
      await sendEmail({ to: [to], ...buildStubEmail(stub) });
      sentTo.push(stub.name);
    } catch (err) {
      await withDb((db) => db.query("delete from email_log where kind = 'stub' and key = $1", [claimKey]));
      console.error(`pay stub for ${stub.name} failed`, err);
    }
  }
  if (sentTo.length) await audit("system", "email.stubs", { weekStart: monday, count: sentTo.length, names: sentTo });
  return { sent: sentTo.length };
}

